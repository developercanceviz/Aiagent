import {
  type CommerceAdapter,
  type CustomerStats,
  type DateRange,
  type NormalizedOrder,
  type NormalizedProduct,
  type OrderOwnershipVerifier,
  type OrderStatus,
  type Paginated,
  type SalesSummary,
} from "@/lib/commerce/types";
import {
  ikasGraphQL,
  LIST_CUSTOMERS,
  LIST_ORDERS,
  LIST_PRODUCTS,
} from "@/lib/commerce/adapters/ikas/graphql";
import {
  normalizeOrder,
  normalizeProduct,
  variantStock,
  type RawOrder,
  type RawProduct,
} from "@/lib/commerce/adapters/ikas/normalize";

export interface IkasCredentials {
  /** Decrypted ikas access token (Bearer). */
  accessToken: string;
  storeId: string;
  graphApiUrl?: string;
}

interface ListResult<T> {
  count: number;
  hasNext: boolean;
  data: T[];
}

/**
 * ikas commerce adapter — the first and only fully-implemented adapter.
 * Read-only on commerce data; ownership is verified before a single order is
 * returned. Pagination uses ikas's page-based `PaginationInput` (page/limit);
 * we expose it through our cursor field as a stringified page number.
 */
export class IkasAdapter implements CommerceAdapter {
  readonly platform = "IKAS" as const;

  constructor(private readonly creds: IkasCredentials) {}

  private gql<T>(query: string, variables?: Record<string, unknown>) {
    return ikasGraphQL<T>({
      accessToken: this.creds.accessToken,
      url: this.creds.graphApiUrl,
      query,
      variables,
    });
  }

  private pageFromCursor(cursor?: string): number {
    const n = cursor ? Number.parseInt(cursor, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  async getOrders(args: {
    since?: Date;
    status?: OrderStatus;
    limit?: number;
    cursor?: string;
  }): Promise<Paginated<NormalizedOrder>> {
    const limit = args.limit ?? 50;

    // With a `since`, filter server-side (orderedAt) and walk pages forward —
    // every page is in-range, so aggregation over the window is complete.
    if (args.since) {
      const page = this.pageFromCursor(args.cursor);
      const data = await this.gql<{ listOrder: ListResult<RawOrder> }>(LIST_ORDERS, {
        pagination: { page, limit },
        orderedAt: { gte: args.since.getTime() },
      });
      const orders = data.listOrder.data.map(normalizeOrder);
      return {
        data: args.status ? orders.filter((o) => o.status === args.status) : orders,
        cursor: data.listOrder.hasNext ? String(page + 1) : undefined,
        hasNextPage: data.listOrder.hasNext,
      };
    }

    // No `since` = "latest orders". The API ignores sort and returns
    // oldest-first, so newest lives on the LAST page: read the count, jump to
    // the tail, and walk backwards (cursor counts down).
    const probe = await this.gql<{ listOrder: ListResult<RawOrder> }>(LIST_ORDERS, {
      pagination: { page: 1, limit: 1 },
    });
    const lastPage = Math.max(1, Math.ceil(probe.listOrder.count / limit));
    const page = args.cursor ? this.pageFromCursor(args.cursor) : lastPage;
    const data = await this.gql<{ listOrder: ListResult<RawOrder> }>(LIST_ORDERS, {
      pagination: { page, limit },
    });
    const orders = data.listOrder.data.map(normalizeOrder).reverse();
    return {
      data: args.status ? orders.filter((o) => o.status === args.status) : orders,
      cursor: page > 1 ? String(page - 1) : undefined,
      hasNextPage: page > 1,
    };
  }

  async getOrderByNumber(
    orderNumber: string,
    verifier: OrderOwnershipVerifier
  ): Promise<NormalizedOrder | null> {
    if (!verifier.email && !verifier.phone) return null;

    // Direct server-side lookup — scanning pages can never work against tens
    // of thousands of oldest-first orders. Ownership is PROVEN against the
    // same response's customer contact before anything is returned (no
    // cross-customer leakage).
    const data = await this.gql<{ listOrder: ListResult<RawOrder> }>(LIST_ORDERS, {
      pagination: { page: 1, limit: 5 },
      orderNumber: { eq: orderNumber },
    });
    const raw = data.listOrder.data.find((o) => o.orderNumber === orderNumber);
    if (!raw) return null;

    const email = raw.customer?.email?.toLowerCase().trim();
    const phone = raw.customer?.phone?.replace(/\D/g, "");
    const vEmail = verifier.email?.toLowerCase().trim();
    const vPhone = verifier.phone?.replace(/\D/g, "");
    const owns = Boolean(
      (vEmail && vEmail === email) || (vPhone && phone && vPhone === phone)
    );
    return owns ? normalizeOrder(raw) : null;
  }

  async searchProducts(query: string): Promise<NormalizedProduct[]> {
    const data = await this.gql<{ listProduct: ListResult<RawProduct> }>(LIST_PRODUCTS, {
      pagination: { page: 1, limit: 20 },
      search: query,
    });
    return data.listProduct.data.map(normalizeProduct);
  }

  async getProduct(id: string): Promise<NormalizedProduct | null> {
    const data = await this.gql<{ listProduct: ListResult<RawProduct> }>(LIST_PRODUCTS, {
      pagination: { page: 1, limit: 1 },
      search: id,
    });
    const found = data.listProduct.data.find((p) => p.id === id) ?? data.listProduct.data[0];
    return found ? normalizeProduct(found) : null;
  }

  async listProducts(args: {
    cursor?: string;
    limit?: number;
  }): Promise<Paginated<NormalizedProduct>> {
    const page = this.pageFromCursor(args.cursor);
    const data = await this.gql<{ listProduct: ListResult<RawProduct> }>(LIST_PRODUCTS, {
      pagination: { page, limit: args.limit ?? 50 },
    });
    return {
      data: data.listProduct.data.map(normalizeProduct),
      cursor: data.listProduct.hasNext ? String(page + 1) : undefined,
      hasNextPage: data.listProduct.hasNext,
    };
  }

  async getProductStock(variantId: string): Promise<number> {
    const data = await this.gql<{ listProduct: ListResult<RawProduct> }>(LIST_PRODUCTS, {
      pagination: { page: 1, limit: 50 },
    });
    for (const p of data.listProduct.data) {
      const v = p.variants?.find((vr) => vr.id === variantId);
      if (v) return variantStock(v);
    }
    return 0;
  }

  async getCustomers(args: {
    cursor?: string;
    limit?: number;
  }): Promise<Paginated<{ id: string; orderCount: number }>> {
    const page = this.pageFromCursor(args.cursor);
    const data = await this.gql<{ listCustomer: ListResult<{ id: string; orderCount: number }> }>(
      LIST_CUSTOMERS,
      { pagination: { page, limit: args.limit ?? 50 } }
    );
    return {
      data: data.listCustomer.data,
      cursor: data.listCustomer.hasNext ? String(page + 1) : undefined,
      hasNextPage: data.listCustomer.hasNext,
    };
  }

  async getCustomerStats(): Promise<CustomerStats> {
    const data = await this.gql<{ listCustomer: ListResult<{ id: string; orderCount: number }> }>(
      LIST_CUSTOMERS,
      { pagination: { page: 1, limit: 100 } }
    );
    const all = data.listCustomer.data;
    const returning = all.filter((c) => c.orderCount > 1).length;
    return {
      total: data.listCustomer.count,
      new: all.length - returning,
      returning,
    };
  }

  async getSalesSummary({ range }: { range: DateRange }): Promise<SalesSummary> {
    const from = range.from ?? new Date(Date.now() - 7 * 86400_000);
    const to = range.to ?? new Date();

    // Aggregate over the range — pages are server-side filtered (orderedAt),
    // so every fetched order is in-window. Cap guards runaway ranges: 50
    // pages × 100 = 5 000 orders (~5 weeks at this store's current volume);
    // beyond that the summary is partial rather than the request failing.
    const orders: NormalizedOrder[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 50; i++) {
      const page = await this.getOrders({ cursor, limit: 100, since: from });
      orders.push(...page.data.filter((o) => new Date(o.createdAt) <= to));
      if (!page.hasNextPage) break;
      cursor = page.cursor;
    }

    const currency = orders[0]?.total.currency ?? "TRY";
    const revenue = orders.reduce((s, o) => s + o.total.amount, 0);
    const orderCount = orders.length;

    const byDayMap = new Map<string, { revenue: number; orders: number }>();
    const cityMap = new Map<string, number>();
    const productMap = new Map<string, { name: string; units: number; revenue: number }>();

    for (const o of orders) {
      const day = o.createdAt.slice(0, 10);
      const d = byDayMap.get(day) ?? { revenue: 0, orders: 0 };
      d.revenue += o.total.amount;
      d.orders += 1;
      byDayMap.set(day, d);

      if (o.city) cityMap.set(o.city, (cityMap.get(o.city) ?? 0) + 1);

      for (const it of o.items) {
        const p = productMap.get(it.productId) ?? { name: it.name, units: 0, revenue: 0 };
        p.units += it.quantity;
        p.revenue += it.unitPrice.amount * it.quantity;
        productMap.set(it.productId, p);
      }
    }

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      revenue: { amount: revenue, currency },
      orderCount,
      averageOrderValue: {
        amount: orderCount ? revenue / orderCount : 0,
        currency,
      },
      byDay: [...byDayMap.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      byChannel: [],
      topProducts: [...productMap.entries()]
        .map(([productId, v]) => ({ productId, ...v }))
        .sort((a, b) => b.units - a.units)
        .slice(0, 5),
      topCities: [...cityMap.entries()]
        .map(([city, orders]) => ({ city, orders }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5),
    };
  }
}
