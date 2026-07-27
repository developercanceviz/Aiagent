import { NextRequest, NextResponse } from "next/server";

import {
  handleMetaVerification,
  normalizeMetaPayload,
  verifyMetaSignature,
} from "@/lib/channels/meta/base";
import { findChannelByExternalId } from "@/lib/db/channel";
import { findOrCreateConversation, appendMessage } from "@/lib/db/conversation";
import { enqueue } from "@/lib/queue";

/**
 * Single Meta webhook for WhatsApp Cloud API, Instagram DM, and Messenger.
 * GET = subscription verification handshake. POST = verify signature →
 * normalize per channel → resolve tenant from the receiving channel id →
 * persist inbound → enqueue the agent turn (which sends the reply back out).
 */

export async function GET(req: NextRequest) {
  const challenge = handleMetaVerification(req.nextUrl.searchParams);
  if (challenge) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inbound = normalizeMetaPayload(payload);

  for (const msg of inbound) {
    const channel = await findChannelByExternalId(msg.externalId);
    if (!channel) continue; // unknown/unconnected channel — ignore

    const conversation = await findOrCreateConversation({
      merchantId: channel.merchantId,
      channelId: channel.id,
      channelType: msg.channelType,
      customerExtId: msg.senderExtId,
      customerName: msg.senderName,
    });

    await appendMessage({
      conversationId: conversation.id,
      role: "CUSTOMER",
      content: msg.text,
    });

    // AI must be enabled for this channel and the conversation not human-owned.
    if (channel.aiEnabled && conversation.handledBy !== "HUMAN") {
      await enqueue({
        name: "channel.process-inbound",
        dedupeId: `${conversation.id}:${msg.receivedAt.getTime()}`,
        payload: { merchantId: channel.merchantId, conversationId: conversation.id },
      });
    }
  }

  // ACK fast regardless — Meta retries on non-200.
  return NextResponse.json({ ok: true });
}
