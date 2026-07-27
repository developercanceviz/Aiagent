import { NextRequest, NextResponse } from "next/server";

import { getWidgetConfig } from "@/lib/db/widget";

const CORS = { "Access-Control-Allow-Origin": "*" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Public widget config used by the embedded bundle to theme itself. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  const { merchantId } = await params;
  const config = await getWidgetConfig(merchantId).catch(() => null);
  if (!config) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  }
  return NextResponse.json(config, { headers: CORS });
}
