import { isConfigured } from "@/lib/config/env";
import { getCurrentMerchantId } from "@/lib/auth/session";
import { getMerchantAdapter } from "@/lib/db/merchant";

export const dynamic = "force-dynamic";

/**
 * Phase 1 proof page: shows live ikas data for the connected merchant. Renders
 * a clear "not connected" state until OAuth + credentials are in place.
 */
export default async function IkasCheckPage() {
  if (!isConfigured.ikas() || !isConfigured.database()) {
    return (
      <Shell>
        <Banner>
          ikas/DB not configured. Add ikas keys + DATABASE_URL, then connect a
          store via <code>/api/auth/ikas/authorize?storeName=cancevizhurma</code>.
        </Banner>
      </Shell>
    );
  }

  const merchantId = await getCurrentMerchantId();
  if (!merchantId) {
    return (
      <Shell>
        <Banner>
          No store connected in this session. Start OAuth at{" "}
          <code>/api/auth/ikas/authorize?storeName=cancevizhurma</code>.
        </Banner>
      </Shell>
    );
  }

  try {
    const adapter = await getMerchantAdapter(merchantId);
    const [orders, products, stats] = await Promise.all([
      adapter.getOrders({ limit: 5 }),
      adapter.listProducts({ limit: 5 }),
      adapter.getCustomerStats(),
    ]);

    return (
      <Shell>
        <h2 className="text-lg font-semibold">Müşteriler</h2>
        <pre className="overflow-auto rounded-xl bg-zinc-900 p-4 text-xs text-zinc-100">
          {JSON.stringify(stats, null, 2)}
        </pre>
        <h2 className="mt-6 text-lg font-semibold">Son 5 Sipariş</h2>
        <pre className="overflow-auto rounded-xl bg-zinc-900 p-4 text-xs text-zinc-100">
          {JSON.stringify(orders.data, null, 2)}
        </pre>
        <h2 className="mt-6 text-lg font-semibold">İlk 5 Ürün</h2>
        <pre className="overflow-auto rounded-xl bg-zinc-900 p-4 text-xs text-zinc-100">
          {JSON.stringify(products.data, null, 2)}
        </pre>
      </Shell>
    );
  } catch (err) {
    return (
      <Shell>
        <Banner>
          Live fetch failed: {String(err instanceof Error ? err.message : err)}
        </Banner>
      </Shell>
    );
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-8">
      <h1 className="text-xl font-semibold">ikas Bağlantı Kontrolü</h1>
      {children}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      {children}
    </div>
  );
}
