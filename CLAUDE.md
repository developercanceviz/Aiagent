# Build Prompt — "Canceviz AI Agent" (Creato-style AI Customer-Support & Store-Assistant SaaS for ikas)

> Paste this whole file as your kickoff brief in Claude Code (or save it as `CLAUDE.md` at repo root).
> Build **incrementally, phase by phase**. Do **not** scaffold everything at once. After each phase, stop, summarize what was built, and wait for my confirmation before continuing.

---

## 0. What we are building

A **multi-tenant SaaS platform** that gives an e-commerce store an AI agent which:

1. **Answers customers** 24/7 across channels (Web Chat first; WhatsApp, Instagram DM, Messenger later) — product questions, order status, FAQ, abandoned-cart recovery, lead capture.
2. **Answers the merchant** (store owner) — an internal analytics assistant that reads store data read-only and replies to questions like "how many orders today?", "top 5 products?", "this month vs last month?".

It must be built **commerce-platform-agnostic behind an adapter layer**, with **ikas as the first and only fully-implemented adapter**. Shopify and a generic "any website" adapter come later — so the architecture must not hardcode ikas anywhere outside `lib/commerce/adapters/ikas/`.

This is modeled on **Creato AI** (creato.digital). I have admin access to the **ikas** platform and a Partner/developer account, and I am building this first for my own store **Canceviz Hurma** (`cancevizhurma.myikas.com`, IG `@canceviz_hurma`).

I am an experienced full-stack dev (Next.js, React, TypeScript, Supabase, shadcn/ui). Write production-grade code, not toy snippets. Prefer clarity and typed boundaries over cleverness.

---

## 1. Tech stack (use exactly this unless you flag a strong reason)

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript (strict).
- **UI:** Tailwind CSS v4 + shadcn/ui + lucide-react. Recharts for charts. dnd-kit for the CRM Kanban.
- **DB / Auth / Realtime / Storage:** Supabase (Postgres + Auth + Realtime + Storage). Use **pgvector** for embeddings.
- **ORM:** Prisma (schema-first) OR Drizzle — pick Prisma for parity with ikas's official starter. Keep all queries in a typed data-access layer (`lib/db/`), never inline in components.
- **AI SDK:** Vercel AI SDK (`ai` package) with tool-calling. Provider-agnostic via a thin wrapper; default provider = Anthropic Claude (`claude-sonnet`-class for chat, a small model for classification). Keep the provider swappable in `lib/ai/provider.ts`.
- **ikas client:** `@ikas/admin-api-client` with GraphQL codegen against `https://api.myikas.com/api/v2/admin/graphql`.
- **Session:** Iron Session (server-side, encrypted cookies) for the ikas OAuth app context, Supabase Auth for merchant dashboard login.
- **Validation:** Zod everywhere at boundaries (API routes, tool inputs, webhooks).
- **Deploy target:** Vercel. Background/long jobs via Vercel cron + Supabase, or a lightweight queue (Upstash QStash) — abstract it so we can swap.

Reference the official ikas starter patterns: `github.com/ikascom/ikas-app-examples` (Next.js 15 App Router, `@ikas/admin-api-client`, Prisma token storage, Iron Session, OAuth flow). Mirror its OAuth/token-refresh approach.

---

## 2. Non-negotiable architecture principles

1. **Multi-tenant from line one.** Every table that holds store data has a `merchantId` (tenant) FK. Every query is scoped by tenant. Enforce with Postgres **Row Level Security** in Supabase. Never trust a `merchantId` from the client — derive it from the authenticated session/app context.
2. **Adapter pattern for commerce platforms.** Define a `CommerceAdapter` interface in `lib/commerce/types.ts`. Implement `IkasAdapter` only. Shopify/Generic are stubs that throw `NotImplemented`. The AI tools and analytics call the adapter interface, never ikas directly.
3. **Adapter pattern for channels.** Define a `ChannelAdapter` interface (`receiveMessage`, `sendMessage`, `verifyWebhook`, `normalizeInbound`). Implement `WebChatAdapter` first. `WhatsAppAdapter`, `InstagramAdapter`, `MessengerAdapter` (all Meta Graph API) are phased later behind the same interface.
4. **Read-only on commerce data by default.** The agents may **read** orders/products/customers and **write only** to our own tables (conversations, leads, notes). No mutations to ikas (no price changes, no order edits) unless a future scope explicitly enables it. The customer agent must never expose another customer's data — order lookups require the customer to provide their own order number/email/phone.
5. **Secrets encrypted at rest.** ikas access/refresh tokens, Meta tokens, and channel credentials are encrypted (libsodium / `crypto` AES-256-GCM) before storage. Never log tokens.
6. **Turkish-first UI.** All merchant-facing UI strings in Turkish (with an i18n layer so EN/DE/AR can be added). The customer agent replies in the customer's language (auto-detect; default TR).
7. **Everything observable.** Structured logging, a `conversation_events` audit trail, and per-message token/cost tracking.

---

## 3. Design system (match the Creato look)

Pull these exact tokens from the reference UI:

- **Background (app):** warm off-white `#F5F5F4` / `#F4F4F5` surfaces, white cards with soft shadows, generous rounded corners (`rounded-2xl`).
- **Primary / accent (green):** `#14DAAA` (buttons, active states, bubbles, highlights).
- **Dark surfaces (sidebar cards, header bg):** `#101216`.
- **Bot message bubble:** `#F4F4F5`; **user/customer bubble:** primary green; header text `#FFFFFF`.
- **Logo lockup:** "CREATO AI"-style wordmark slot — make it a configurable `BrandLogo` component (I'll rebrand it; default name placeholder = "Canceviz AI" / agency brand). Do **not** hardcode "Creato".
- **Typography:** clean geometric sans (Inter / Geist). Tight, confident headings; muted gray secondary text.
- **Sidebar:** slim left rail with icon nav (Dashboard, CRM, Mesajlar, Duyurular, Ayarlar) + collapsible. A dark "Asistan / Soru Sor" card pinned near the top.
- **Charts:** soft area charts with green fill gradient; donut for channel distribution; stacked bars for daily per-channel volume.

Read the `frontend-design` skill before building any UI and keep the aesthetic intentional, not templated.

---

## 4. Data model (Prisma — refine as needed, keep RLS in mind)

```prisma
model Merchant {            // tenant = one connected store
  id              String   @id @default(cuid())
  platform        Platform @default(IKAS)
  externalStoreId String   // ikas merchantId / storeId
  storeName       String
  storeDomain     String?  // cancevizhurma.myikas.com
  accessToken     String   // ENCRYPTED
  refreshToken    String?  // ENCRYPTED
  tokenExpiresAt  DateTime?
  plan            String   @default("trial")
  createdAt       DateTime @default(now())
  users           User[]
  agents          Agent[]
  channels        Channel[]
  conversations   Conversation[]
  leads           Lead[]
  knowledgeItems  KnowledgeItem[]
  quickReplies    QuickReply[]
  widgetConfig    WidgetConfig?
}

model User {                // merchant staff (dashboard login via Supabase Auth)
  id         String  @id @default(cuid())
  merchantId String
  email      String
  role       Role    @default(OWNER)
  merchant   Merchant @relation(fields: [merchantId], references: [id])
}

model Agent {               // the customer-facing assistant config
  id           String  @id @default(cuid())
  merchantId   String
  name         String  // "Can Ceviz Müşteri Destek Asistanı"
  status       AgentStatus @default(ACTIVE)
  persona      String  // tone/personality
  systemPrompt String  // composed base prompt (guardrails injected at runtime)
  language     String  @default("tr")
  merchant     Merchant @relation(fields: [merchantId], references: [id])
  channels     Channel[]
}

model Channel {
  id          String      @id @default(cuid())
  merchantId  String
  agentId     String?
  type        ChannelType // WEBCHAT | WHATSAPP | INSTAGRAM | MESSENGER
  displayName String      // "@canceviz_hurma", "+90 553 ..."
  externalId  String?     // page id / phone number id / ig id
  credentials String?     // ENCRYPTED JSON
  aiEnabled   Boolean     @default(true)  // the per-channel "AI Aktif/Pasif" toggle
  status      ChannelStatus @default(DISCONNECTED)
  merchant    Merchant @relation(fields: [merchantId], references: [id])
}

model Conversation {
  id              String   @id @default(cuid())
  merchantId      String
  channelId       String
  channelType     ChannelType
  customerExtId   String   // platform-scoped sender id
  customerName    String?
  status          ConvStatus @default(OPEN)   // OPEN | AI_HANDLED | NEEDS_HUMAN | CLOSED
  handledBy       HandledBy  @default(AI)     // AI | HUMAN
  lastMessageAt   DateTime @default(now())
  unreadCount     Int      @default(0)
  starred         Boolean  @default(false)
  archived        Boolean  @default(false)
  messages        Message[]
  lead            Lead?
  merchant        Merchant @relation(fields: [merchantId], references: [id])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           MsgRole  // CUSTOMER | AI | HUMAN_AGENT | SYSTEM
  content        String
  toolCalls      Json?
  tokensIn       Int?
  tokensOut      Int?
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

model Lead {                // CRM Kanban card
  id             String   @id @default(cuid())
  merchantId     String
  conversationId String?  @unique
  name           String
  contact        String?
  stage          LeadStage @default(YENI)   // YENI | GORUSMEDE | TAKIP | OLUMLU | OLUMSUZ
  tags           String[]
  note           String?
  orderPosition  Int      @default(0)
  merchant       Merchant @relation(fields: [merchantId], references: [id])
}

model KnowledgeItem {       // RAG source: FAQ, policies, synced products
  id          String  @id @default(cuid())
  merchantId  String
  type        KbType  // FAQ | DOCUMENT | PRODUCT | POLICY
  title       String
  content     String
  sourceRef   String? // ikas product id, file name, etc.
  embedding   Unsupported("vector(1536)")?  // pgvector
  updatedAt   DateTime @updatedAt
  merchant    Merchant @relation(fields: [merchantId], references: [id])
}

model QuickReply {          // "Hazır Mesajlar"
  id         String @id @default(cuid())
  merchantId String
  title      String
  content    String
  merchant   Merchant @relation(fields: [merchantId], references: [id])
}

model WidgetConfig {        // Web Chat widget customization
  id            String @id @default(cuid())
  merchantId    String @unique
  theme         String @default("creato")  // creato|royalBlue|sunset|rose|purple|emerald
  primaryColor  String @default("#14DAAA")
  headerBg      String @default("#101216")
  headerText    String @default("#FFFFFF")
  userMsgColor  String @default("#14DAAA")
  botMsgColor   String @default("#F4F4F5")
  bubbleColor   String @default("#14DAAA")
  bubbleIcon    String @default("#101216")
  bubbleSize    Int    @default(60)
  position      String @default("bottom-right")
  greeting      String @default("Merhaba! 👋 Size nasıl yardımcı olabilirim?")
  socialLinks   Json?  // instagram, whatsapp, messenger, tiktok
  active        Boolean @default(true)
  merchant      Merchant @relation(fields: [merchantId], references: [id])
}

model Announcement {        // platform-level "Duyurular" (global, not per-tenant)
  id          String @id @default(cuid())
  title       String
  body        String
  badge       String? // "YENİ ÖZELLİK"
  publishedAt DateTime @default(now())
}

// enums: Platform, Role, AgentStatus, ChannelType, ChannelStatus,
// ConvStatus, HandledBy, MsgRole, LeadStage, KbType
```

---

## 5. ikas integration (the only fully-built commerce adapter)

**Auth & app model** — build as an ikas app (the same way the influencer-system app was built):

- Private/partner app with **client_id + client_secret**. OAuth authorize → exchange for **access_token** (+ refresh). Store encrypted on `Merchant`. Implement automatic **token refresh** with retry, mirroring `ikas-app-examples`.
- GraphQL endpoint: `https://api.myikas.com/api/v2/admin/graphql`. Header: `Authorization: Bearer <access_token>`. Use `@ikas/admin-api-client` + GraphQL codegen for typed queries.
- Request only the **scopes** we need (read: products, orders, customers; webhooks). Document each scope and why.

**`IkasAdapter` must implement at minimum:**

- `getOrders({ since, status, limit, cursor })` → normalized orders (id, number, status, total, currency, items, customer ref, createdAt). Use `listOrder` with pagination (GraphQL `data` + cursor pattern).
- `getOrderByNumber(orderNumber, customerVerifier)` → single order, **only after verifying** the requester owns it (match email/phone/order number).
- `searchProducts(query)` / `getProduct(id)` / `listProducts({cursor})` → name, price, stock, variants, images, url. (`listProduct`).
- `getProductStock(variantId)`.
- `getCustomers({cursor})` / `getCustomerStats()` → counts, new vs returning (`listCustomer`, has `orderCount`).
- `getSalesSummary({ range })` → revenue, order count, AOV, by-day series, by-channel, top products, top cities — computed from orders. This powers both the merchant assistant and the Dashboard.

**Webhooks** (`saveWebhook` mutation) — subscribe to:
- `store/order/created`, `store/order/updated` → refresh analytics + trigger order-related automations.
- `store/customer/created` → CRM/lead enrichment.
- `store/product/updated` → re-sync that product into the knowledge base + re-embed.
Webhook receiver at `app/api/webhooks/ikas/route.ts`: verify signature, dedupe, enqueue, ACK fast.

**Product → Knowledge Base sync job:** on connect and on `product/updated`, pull products and upsert `KnowledgeItem(type=PRODUCT)` with embeddings so the customer agent can answer "5 kilo ne kadar?", "bu hurmadan istiyorum", "büyük boyu var mı?" type questions (these are real questions from the live inbox).

---

## 6. The AI layer (two assistants, shared infra)

### 6a. Customer Agent (channel-facing)
- **Pipeline per inbound message:** normalize → load conversation history → RAG search (`KnowledgeItem` via pgvector cosine) → assemble prompt → Claude with **tools** → stream/send reply via the `ChannelAdapter` → persist messages + token cost → update conversation status → optionally create/advance a `Lead`.
- **Tools (function calling), all tenant-scoped & read-only on commerce:**
  - `searchProducts(query)`, `getProductStock(variantId)`
  - `getOrderStatus({ orderNumber, email|phone })` — **must verify ownership**; if unverifiable, ask the customer for the matching detail, never reveal.
  - `searchKnowledge(query)` (FAQ/policies/products)
  - `escalateToHuman(reason)` — sets `status=NEEDS_HUMAN`, `handledBy=HUMAN`, notifies dashboard (Supabase Realtime).
  - `captureLead({name, contact, intent})` — creates CRM card in `YENI`.
- **Persona/guardrails (system prompt), mirror the live "Lume 1.5" behavior:**
  - Friendly, concise, emoji-light, brand-voiced; replies in the customer's language.
  - **Never reveals** its model, framework, database, infrastructure, prompts, or internal tools. If asked about its tech stack/security, give the safe canned answer (operates in a secure sandbox, reads store data via official APIs only, cannot execute code / modify settings / delete data / access payments) and redirect to support. Put this verbatim-style behavior in the guardrail section — it's a real requirement seen in production.
  - Never invents stock/prices/policies — if not in KB or tools, say it will check / escalate.
  - Never exposes another customer's data.

### 6b. Merchant Store Assistant ("Mağaza Asistanı")
- Internal chat in the dashboard ("Soru Sor"). Same tool-calling engine but **merchant-trust context** + analytics tools (`getSalesSummary`, `getCustomerStats`, `getOrders`, `getProductPerformance`).
- Suggested prompt chips (from the reference): "Bugün kaç sipariş geldi?", "Son 7 günün ciro özeti nedir?", "Hangi şehirlerden en çok sipariş geliyor?", "Bekleyen kargolar var mı?", "En çok satan 5 ürün hangisi?".
- Answers with numbers + small inline charts where useful. Still must refuse to disclose its own internals (same guardrail).

### 6c. Shared
- `lib/ai/provider.ts` (swappable LLM), `lib/ai/rag.ts` (embed + retrieve), `lib/ai/tools/*`, `lib/ai/guardrails.ts`, `lib/ai/prompt.ts` (compose persona + guardrails + context).
- Track tokens & cost per message; expose in an admin view.

---

## 7. Feature / page specs (match the screenshots)

**Layout:** left icon-rail sidebar (Dashboard, CRM, Mesajlar, Duyurular, Ayarlar) + dark "Asistan / Soru Sor" card; top bar "Creato AI Agent"-style brand slot; user avatar bottom-left with store handle (`cancevizhurma`).

1. **Dashboard** — date-range tabs (1/3/7/15/30 gün). KPI cards: Toplam Konuşma, AI Yanıtları, Canlı Destek, Ort. Yanıt Süresi (each with % delta). "Konuşma Performansı" area chart (Sohbet · AI Yanıtı · Canlı Destek). "Kanal Dağılımı" donut (Instagram/Messenger/Webchat/WhatsApp). "Kanal Bazlı Konuşmalar" stacked bars (daily). "Bağlı Agent'lar" list. "AI Performans" panel. "Kanal Durumu" (Instagram/WhatsApp/Messenger with Aktif badges). "Son Konuşmalar" feed. Quick links: Mağaza Asistanı, Bilgi Bankası, Mesajlara Git.

2. **CRM — "Lead Listesi"** — Kanban board with columns **YENİ · GÖRÜŞMEDE · TAKİP · OLUMLU · OLUMSUZ** (drag-and-drop via dnd-kit, persists `stage` + order). Board/Table view toggle, Etiketler (tags), "+ Yeni Lead Ekle". Empty columns show "Boş".

3. **Mesajlar (unified inbox)** — left conversation list with search ("Kişi veya mesaj ara…"), filter tabs (Tümü/Instagram/WhatsApp/Canlı), Yıldız/Arşiv filters, per-row channel icon + AI badge + relative time + unread count. Right pane: conversation thread; when AI is handling show it, allow **human takeover** (flips `handledBy=HUMAN`, pauses AI for that conversation). Realtime updates via Supabase Realtime. Empty state: "Bir konuşma seçin".

4. **Duyurular** — announcements feed ("Duyurular & Yenilikler") with badges ("YENİ ÖZELLİK"), title, date, body. Reads from `Announcement`.

5. **Ayarlar** — sub-pages:
   - **AI Agent:** "Yeni AI Agent Talep Et" header; "Agent'larınız" (name, `agn_...` id, conversation/message counts, AKTİF badge); **"Kanal AI Kontrolü"** — per-channel **AI Aktif/Pasif** toggles (WhatsApp, Messenger, Web Chat, Instagram) writing `Channel.aiEnabled`.
   - **Kanallar:** "X / Y Bağlı" + Yenile; BAĞLI KANALLAR cards (Instagram DM `@canceviz_hurma`, WhatsApp Business `+90…`, Facebook Messenger) each with reconnect; EKLENEBİLECEK KANALLAR; info note: channel linking uses Meta Business Suite admin login via secure OAuth.
   - **Web Chat (Widget Ayarları):** Görünüm/İçerik/Konum/Sosyal tabs. Hazır Temalar (Creato/Royal Blue/Sunset/Rose/Purple/Emerald), color pickers (Ana Renk `#14DAAA`, Başlık Arkaplanı `#101216`, Başlık Metin `#FFFFFF`, Kullanıcı Mesaj, Bot Mesaj `#F4F4F5`, Baloncuk Rengi/İkon, Baloncuk Boyutu slider 60px), **live preview** of the floating widget ("Canceviz Hurma · Çevrimiçi", greeting, social row IG/WA/Messenger/TikTok, "Powered by …"), "Güncelle & Yayınla" + "Mağazada Görüntüle".
   - **Hazır Mesajlar:** searchable list of quick-reply templates + "Yeni Ekle"; empty state "Hazır mesaj bulunamadı".

6. **Embeddable Web Chat widget** (separate bundle) — a tiny JS snippet the store embeds (`<script src="…/widget.js" data-merchant="...">`). Renders the floating bubble + chat, talks to `app/api/chat/webchat/route.ts`, respects `WidgetConfig`, shows social links, "Powered by". This is the first live channel.

---

## 8. Repo structure (target)

```
/app
  /(dashboard)/dashboard, /crm, /mesajlar, /duyurular, /ayarlar/{ai-agent,kanallar,web-chat,hazir-mesajlar}
  /api/auth/ikas/{authorize,callback}        # OAuth
  /api/webhooks/ikas/route.ts
  /api/webhooks/meta/route.ts                # later
  /api/chat/webchat/route.ts                 # widget inbound
  /api/chat/assistant/route.ts               # merchant store assistant
  /api/channels/[type]/route.ts
/lib
  /commerce/{types.ts, adapters/ikas/*, adapters/shopify/stub.ts}
  /channels/{types.ts, webchat/*, whatsapp/*, instagram/*, messenger/*}
  /ai/{provider.ts, rag.ts, prompt.ts, guardrails.ts, tools/*}
  /db/* (prisma client + data-access)
  /crypto/* (token encryption)
  /auth/* (iron-session + supabase)
/widget   # standalone embeddable web-chat build
/prisma/schema.prisma
/components/ui (shadcn) + /components/charts, /components/inbox, /components/kanban
```

---

## 9. Environment variables (create `.env.example`)

```
# ikas
NEXT_PUBLIC_GRAPH_API_URL=https://api.myikas.com/api/v2/admin/graphql
NEXT_PUBLIC_IKAS_CLIENT_ID=
IKAS_CLIENT_SECRET=
NEXT_PUBLIC_DEPLOY_URL=
SECRET_COOKIE_PASSWORD=        # long random, iron-session
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
# AI
ANTHROPIC_API_KEY=
EMBEDDINGS_PROVIDER_KEY=
# crypto
ENCRYPTION_KEY=                # 32-byte base64 for AES-256-GCM
# Meta (later)
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
```

---

## 10. Build phases (do these in order, stop after each)

**Phase 0 — Foundation.** Repo, Next.js 15 + TS strict, Tailwind v4, shadcn/ui, Prisma + Supabase, RLS scaffolding, design tokens, app shell (sidebar + topbar + brand slot), i18n (TR default). Deliver a running skeleton with empty pages.

**Phase 1 — ikas connection.** OAuth authorize/callback, encrypted token storage, token refresh, `IkasAdapter` (orders/products/customers/sales summary) with codegen, a `/dev/ikas-check` page proving live data from Canceviz. Webhook receiver + `saveWebhook` registration.

**Phase 2 — Merchant Store Assistant.** AI engine, provider wrapper, analytics tools, guardrails, the "Soru Sor" chat with prompt chips, inline numbers/charts. This gives me value immediately on my own store.

**Phase 3 — Dashboard.** All KPI cards, charts (area/donut/stacked), channel status, recent conversations, quick links — fed by `IkasAdapter` + our conversation tables.

**Phase 4 — Knowledge Base + RAG.** Product sync + embeddings, FAQ/policy CRUD ("Bilgi Bankası"), pgvector retrieval.

**Phase 5 — Web Chat channel + Customer Agent.** Embeddable widget, `WidgetConfig` + Görünüm settings + live preview, `WebChatAdapter`, customer-agent pipeline with tools (product/order/KB/escalate/lead), guardrails. End-to-end: a visitor on the store chats and gets AI answers.

**Phase 6 — Mesajlar (unified inbox) + human takeover.** Realtime conversation list/thread, filters, AI badge, takeover, Hazır Mesajlar quick replies.

**Phase 7 — CRM Kanban.** dnd-kit board (Yeni/Görüşmede/Takip/Olumlu/Olumsuz), tags, lead capture from conversations, Board/Table toggle.

**Phase 8 — Per-channel AI control + Ayarlar polish + Duyurular.** AI Aktif/Pasif toggles, channels page, announcements.

**Phase 9 — Meta channels (WhatsApp Cloud API, Instagram DM, Messenger).** Single Meta webhook, per-channel adapters behind `ChannelAdapter`, OAuth via Meta Business Suite, signature verification. (Note: requires a verified Meta business app + permissions — flag the approval steps; build the code so it's ready when access is granted.)

**Phase 10 — Hardening.** Rate limiting, cost/usage dashboard, audit trail, error states, tests for adapters/tools/guardrails, Shopify adapter stub fleshed into a second real adapter.

---

## 11. Acceptance criteria (apply every phase)

- Strict TypeScript, no `any` at boundaries; Zod-validated inputs.
- Tenant isolation provably enforced (RLS + scoped queries). Add a test that one merchant cannot read another's rows.
- No secret ever logged or sent to the client.
- The customer agent passes guardrail tests: refuses tech-stack disclosure, refuses cross-customer data, never fabricates stock/price.
- Turkish UI strings centralized in the i18n layer (no hardcoded literals in components).
- Each phase ends with: a short README section, the env vars it introduced, and a manual test script I can run against Canceviz.

---

## 12. First action

Start **Phase 0 only**. Propose the exact folder structure and `package.json`, set up the app shell with the sidebar/topbar matching the design tokens in §3, wire Supabase + Prisma + RLS scaffolding, and stub the five main pages with Turkish titles. Then stop and show me what you built before touching ikas.

When you need a decision from me (e.g., Prisma vs Drizzle, queue choice, Meta app readiness), ask a single focused question rather than guessing.