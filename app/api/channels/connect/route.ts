import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireMerchantId } from "@/lib/auth/context";
import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { encryptSecret } from "@/lib/crypto/secrets";

/**
 * Connect (or refresh) a Meta messaging channel for the authenticated tenant.
 * The caller pastes the provider credentials in the dashboard; they are
 * encrypted at rest and NEVER returned by any endpoint. Tenant comes from the
 * verified session (cookie or App Bridge token) — not the body.
 */
const ConnectBody = z.object({
  type: z.enum(["WHATSAPP", "INSTAGRAM", "MESSENGER"]),
  /** Receiving id the webhook resolves the tenant by:
   *  phone_number_id (WhatsApp) / IG user id (Instagram) / page id (Messenger). */
  externalId: z.string().min(3),
  displayName: z.string().min(1),
  accessToken: z.string().min(10),
  phoneNumberId: z.string().nullable().default(null),
  pageId: z.string().nullable().default(null),
  igId: z.string().nullable().default(null),
  apiBase: z.enum(["facebook", "instagram"]).nullable().default(null),
});

export async function POST(req: NextRequest) {
  if (!isConfigured.database()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const merchantId = await requireMerchantId(req);
  if (!merchantId) {
    return NextResponse.json({ error: "No store in session." }, { status: 401 });
  }

  const parsed = ConnectBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const credentials = encryptSecret(
    JSON.stringify({
      accessToken: body.accessToken,
      phoneNumberId: body.phoneNumberId ?? undefined,
      pageId: body.pageId ?? undefined,
      igId: body.igId ?? undefined,
      apiBase: body.apiBase ?? undefined,
    })
  );

  const existing = await prisma.channel.findFirst({
    where: { merchantId, type: body.type },
    select: { id: true },
  });

  const channel = existing
    ? await prisma.channel.update({
        where: { id: existing.id },
        data: {
          displayName: body.displayName,
          externalId: body.externalId,
          credentials,
          status: "CONNECTED",
        },
      })
    : await prisma.channel.create({
        data: {
          merchantId,
          type: body.type,
          displayName: body.displayName,
          externalId: body.externalId,
          credentials,
          status: "CONNECTED",
        },
      });

  return NextResponse.json({
    ok: true,
    channelId: channel.id,
    type: channel.type,
    status: channel.status,
  });
}
