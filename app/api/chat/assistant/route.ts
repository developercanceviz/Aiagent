import { convertToCoreMessages, streamText, type Message } from "ai";

import { isConfigured } from "@/lib/config/env";
import { getModel } from "@/lib/ai/provider";
import { buildMerchantPrompt } from "@/lib/ai/prompt";
import { buildMerchantTools } from "@/lib/ai/tools/merchant-tools";
import { requireMerchantId } from "@/lib/auth/context";
import { getMerchant, getMerchantAdapter } from "@/lib/db/merchant";

export const maxDuration = 60;

/**
 * Merchant Store Assistant ("Soru Sor"). Streams a Claude response with the
 * merchant guardrails + analytics tools bound to THIS tenant's adapter. Tenant
 * is derived from verified credentials — an ikas App Bridge token when
 * embedded, the session cookie when standalone — never the request body.
 */
export async function POST(req: Request) {
  if (!isConfigured.ai()) {
    return Response.json(
      { error: "AI not configured. Set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }
  if (!isConfigured.ikas() || !isConfigured.database()) {
    return Response.json(
      { error: "Store not connected. Connect ikas + database to query live data." },
      { status: 503 }
    );
  }

  const merchantId = await requireMerchantId(req);
  if (!merchantId) {
    return Response.json({ error: "No store in session." }, { status: 401 });
  }

  const { messages } = (await req.json()) as { messages: Message[] };

  const [merchant, adapter] = await Promise.all([
    getMerchant(merchantId),
    getMerchantAdapter(merchantId),
  ]);

  const system = buildMerchantPrompt({
    storeName: merchant?.storeName ?? "Mağaza",
  });

  const result = streamText({
    model: getModel("chat"),
    system,
    messages: convertToCoreMessages(messages),
    tools: buildMerchantTools(adapter),
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
