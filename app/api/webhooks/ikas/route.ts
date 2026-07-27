import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

import { getMerchantByExternalId } from "@/lib/db/merchant";
import { enqueue } from "@/lib/queue";
import type { JobName } from "@/lib/queue/types";

/**
 * ikas webhook receiver: verify signature → map scope to a job → enqueue →
 * ACK fast. Dedupe is delegated to the queue (Upstash-Deduplication-Id).
 */

const scopeToJob: Record<string, JobName | undefined> = {
  "store/order/created": "ikas.order-changed",
  "store/order/updated": "ikas.order-changed",
  "store/customer/created": "ikas.customer-created",
  "store/product/updated": "ikas.sync-products",
};

function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.IKAS_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-ikas-signature");

  if (!verifySignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { scope?: string; merchantId?: string; storeId?: string; data?: { id?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scope = body.scope ?? "";
  const job = scopeToJob[scope];
  if (!job) return NextResponse.json({ ok: true, ignored: scope });

  const externalStoreId = body.merchantId ?? body.storeId ?? "";
  const merchant = await getMerchantByExternalId("IKAS", externalStoreId);
  if (!merchant) {
    // Unknown store — ACK so ikas stops retrying, but record nothing.
    return NextResponse.json({ ok: true, unknownStore: true });
  }

  const dedupeId = `${scope}:${body.data?.id ?? ""}:${req.headers.get("x-ikas-event-id") ?? ""}`;
  await enqueue({
    name: job,
    dedupeId,
    payload: {
      merchantId: merchant.id,
      orderId: body.data?.id,
      customerId: body.data?.id,
    },
  });

  return NextResponse.json({ ok: true });
}
