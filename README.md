# Canceviz AI Agent

Multi-tenant SaaS that gives an e-commerce store an AI agent which (1) answers
customers 24/7 across channels and (2) answers the merchant as an internal
analytics assistant. Commerce-platform-agnostic behind an adapter layer, with
**ikas** as the first fully-implemented adapter. Modeled on Creato AI; built
first for **Canceviz Hurma** (`cancevizhurma.myikas.com`).

See `CLAUDE.md` for the full product brief.

---

## Status: all phases implemented (code-complete) ✅

Every phase (0–10) is built in code. `npm run build` compiles all 23 routes,
`tsc --noEmit` is clean, and `npm run test` is green (14 tests).

**The app runs with zero environment variables** — data layers fall back to mock
and the AI/commerce/Meta endpoints return a clear `503`/`403` until their keys
are added. Live behavior (real ikas data, Claude replies, Meta channels) turns
on the moment you fill `.env.local` and connect a store. No code changes needed.

### Phase map

| Phase | What | Key files |
| --- | --- | --- |
| 0 Foundation | Next.js 15 shell, Tailwind v4 design system, i18n (TR), Prisma schema, RLS, crypto | `app/`, `components/`, `lib/i18n`, `prisma/`, `supabase/policies.sql` |
| 1 ikas connection | OAuth, encrypted token storage + refresh, `IkasAdapter` (GraphQL), webhook receiver, QStash queue, product→KB sync, `/dev/ikas-check` | `lib/auth`, `lib/commerce/adapters/ikas`, `lib/queue`, `app/api/auth/ikas`, `app/api/webhooks/ikas` |
| 2 Store Assistant | Analytics tools + streaming chat (Claude + guardrails), `/asistan` | `lib/ai/tools/merchant-tools.ts`, `app/api/chat/assistant` |
| 3 Dashboard | Live data layer (adapter + conversations) w/ mock fallback | `lib/dashboard/data.ts`, `components/dashboard` |
| 4 Knowledge + RAG | Embeddings, pgvector retrieval, Bilgi Bankası CRUD | `lib/ai/rag.ts`, `lib/db/knowledge.ts`, `app/(dashboard)/bilgi-bankasi` |
| 5 Web Chat + Customer Agent | Agent pipeline + tools (product/order/KB/escalate/lead), webchat API, embeddable widget | `lib/ai/customer-agent.ts`, `lib/ai/tools/customer-tools.ts`, `app/api/chat/webchat`, `app/widget`, `public/widget.js` |
| 6 Inbox + takeover | Conversation data-access, realtime hook, thread + human takeover | `lib/actions/conversation.ts`, `components/inbox`, `lib/realtime` |
| 7 CRM Kanban | dnd-kit board, stage persistence, Board/Table toggle | `components/kanban/crm-board.tsx`, `lib/actions/lead.ts` |
| 8 AI control + Duyurular | Per-channel `aiEnabled` toggle, announcements from DB | `lib/actions/channel.ts`, `lib/actions/announcement.ts` |
| 9 Meta channels | WhatsApp/Instagram/Messenger adapters + single Meta webhook (verify + signature) | `lib/channels/meta`, `app/api/webhooks/meta` |
| 10 Hardening | Rate limiting, audit trail, token/cost tracking, tests | `lib/ratelimit.ts`, `lib/db/audit.ts`, `lib/ai/usage.ts`, `tests/` |

---

## Getting started

```bash
npm install
cp .env.example .env.local      # optional — app runs without it (mock mode)
npx prisma generate
npm run dev                     # http://localhost:3000 → /dashboard
```

Scripts: `npm run build` · `npm run typecheck` · `npm run test` ·
`npm run db:push` · `npm run db:migrate`.

### Turning on live features

1. **Database** — set `DATABASE_URL` + `DIRECT_URL` (Supabase Postgres), then
   `npx prisma db push` and run `supabase/policies.sql` in the SQL editor (RLS).
2. **ikas** — set `NEXT_PUBLIC_IKAS_CLIENT_ID`, `IKAS_CLIENT_SECRET`,
   `ENCRYPTION_KEY` (`openssl rand -base64 32`), `SECRET_COOKIE_PASSWORD`.
   Connect a store: visit `/api/auth/ikas/authorize?storeName=cancevizhurma`,
   then verify at `/dev/ikas-check`.
   > GraphQL field selections in `lib/commerce/adapters/ikas/graphql.ts` follow
   > the documented ikas Admin API; validate them against live codegen on first
   > connect (the one place to double-check).
3. **AI** — set `ANTHROPIC_API_KEY`. `/asistan` and the Web Chat agent go live.
4. **RAG** — set `EMBEDDINGS_PROVIDER_KEY` (OpenAI-compatible). Product sync and
   `searchKnowledge` start grounding answers.
5. **Queue** — set `QSTASH_TOKEN` for Upstash QStash; otherwise jobs run inline.
6. **Meta channels** — set `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`;
   point the Meta webhook at `/api/webhooks/meta`. Requires a verified Meta
   business app + permissions.

### Embedding the Web Chat widget on a store

```html
<script src="https://YOUR_DEPLOY/widget.js" data-merchant="MERCHANT_ID"></script>
```

---

## Architecture principles (enforced)

1. **Multi-tenant** — every store row has `merchantId`; `merchantId` derived from
   session/app context, never the client (`lib/db/tenant.ts`); Supabase RLS as
   the hard backstop.
2. **Adapter pattern** — AI/analytics call `CommerceAdapter` & `ChannelAdapter`,
   never ikas/Meta directly. ikas lives only under
   `lib/commerce/adapters/ikas/`.
3. **Read-only on commerce data**; writes only to our own tables. Order lookups
   require ownership proof (email/phone).
4. **Secrets encrypted at rest** (AES-256-GCM); tokens never logged.
5. **Turkish-first UI** via the i18n layer; customer agent replies in the
   customer's language.
6. **Guardrails** — the customer agent refuses to disclose its stack and gives
   the safe canned answer (tested in `tests/guardrails.test.ts`).

## Tests

`npm run test` — crypto round-trip, guardrail content/ordering, tenant-scope
enforcement, and ikas normalizers.
