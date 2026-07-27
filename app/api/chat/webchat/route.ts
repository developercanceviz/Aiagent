import { streamText } from "ai";
import { z } from "zod";

import { isConfigured } from "@/lib/config/env";
import { getModel } from "@/lib/ai/provider";
import { prepareAgentRun } from "@/lib/ai/customer-agent";
import { appendMessage, findOrCreateConversation } from "@/lib/db/conversation";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const bodySchema = z.object({
  merchantId: z.string().min(1),
  sessionId: z.string().min(1),
  customerName: z.string().max(120).optional(),
  messages: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .min(1),
});

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Public, embeddable Web Chat inbound endpoint. Runs the customer-agent
 * pipeline and streams the reply. Persists both turns + token cost. Respects
 * human-takeover (silent if a human owns the conversation).
 */
export async function POST(req: Request) {
  if (!isConfigured.ai() || !isConfigured.database() || !isConfigured.ikas()) {
    return Response.json(
      { error: "Web Chat agent not configured (needs AI + DB + ikas)." },
      { status: 503, headers: CORS }
    );
  }

  const limited = rateLimit(clientKey(req, "webchat"), { limit: 20, windowMs: 60_000 });
  if (!limited.ok) {
    return Response.json(
      { error: "Çok fazla istek. Lütfen biraz sonra tekrar deneyin." },
      { status: 429, headers: CORS }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400, headers: CORS });
  }
  const { merchantId, sessionId, customerName, messages: incoming } = parsed.data;
  const lastUser = [...incoming].reverse().find((m) => m.role === "user");
  const message = lastUser?.content?.trim();
  if (!message) {
    return Response.json({ error: "No user message" }, { status: 400, headers: CORS });
  }

  const conversation = await findOrCreateConversation({
    merchantId,
    channelId: "webchat",
    channelType: "WEBCHAT",
    customerExtId: sessionId,
    customerName,
  });

  if (conversation.handledBy === "HUMAN") {
    return Response.json(
      { handedToHuman: true, message: "Bir temsilcimiz en kısa sürede yanıtlayacak." },
      { headers: CORS }
    );
  }

  await appendMessage({ conversationId: conversation.id, role: "CUSTOMER", content: message });

  const { system, messages, tools } = await prepareAgentRun({
    merchantId,
    conversationId: conversation.id,
    latestUserText: message,
  });

  const result = streamText({
    model: getModel("chat"),
    system,
    messages,
    tools,
    maxSteps: 5,
    onFinish: async ({ text, usage }) => {
      await appendMessage({
        conversationId: conversation.id,
        role: "AI",
        content: text,
        tokensIn: usage.promptTokens,
        tokensOut: usage.completionTokens,
      });
    },
  });

  return result.toDataStreamResponse({ headers: CORS });
}
