/**
 * Minimal typed GraphQL client for the ikas Admin API. We POST hand-written
 * queries to https://api.myikas.com/api/v2/admin/graphql with a Bearer token.
 *
 * Field selections were validated against the LIVE schema via introspection on
 * 2026-07-27 (Canceviz Hurma store). Notable realities vs. the docs:
 *   - OrderAddress.city is an OBJECT (OrderAddressCity { name }), not a string.
 *   - Product has NO `images`/`url`; images live on variants (ProductImage),
 *     and variant stock is `stocks: [ProductStockLocation]`, not a count.
 *   - The webhook mutation is `saveWebhooks(input: WebhookInput!)` with a
 *     `scopes: [String]!` list — one call registers everything.
 */

const DEFAULT_URL = "https://api.myikas.com/api/v2/admin/graphql";

export interface IkasGraphQLError {
  message: string;
}

export async function ikasGraphQL<T>(args: {
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
  url?: string;
}): Promise<T> {
  const res = await fetch(args.url ?? process.env.NEXT_PUBLIC_GRAPH_API_URL ?? DEFAULT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: args.query, variables: args.variables ?? {} }),
    // Server-only; never cache authenticated commerce reads.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`ikas GraphQL HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: IkasGraphQLError[] };
  if (json.errors?.length) {
    throw new Error(`ikas GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("ikas GraphQL returned no data");
  return json.data;
}

// ── Query documents ────────────────────────────────────────────────────────

export const LIST_ORDERS = /* GraphQL */ `
  query ListOrders($pagination: PaginationInput, $sort: String) {
    listOrder(pagination: $pagination, sort: $sort) {
      count
      hasNext
      data {
        id
        orderNumber
        status
        totalFinalPrice
        currencyCode
        createdAt
        customer { id email phone }
        billingAddress { city { name } }
        orderLineItems {
          quantity
          finalPrice
          variant { id productId name }
        }
      }
    }
  }
`;

export const LIST_PRODUCTS = /* GraphQL */ `
  query ListProducts($pagination: PaginationInput, $search: String) {
    listProduct(pagination: $pagination, search: $search) {
      count
      hasNext
      data {
        id
        name
        description
        totalStock
        variants {
          id
          sku
          stocks { stockCount }
          prices { sellPrice currency currencyCode }
          images { imageId isMain order }
        }
      }
    }
  }
`;

export const LIST_CUSTOMERS = /* GraphQL */ `
  query ListCustomers($pagination: PaginationInput) {
    listCustomer(pagination: $pagination) {
      count
      hasNext
      data { id orderCount }
    }
  }
`;

export const SAVE_WEBHOOKS = /* GraphQL */ `
  mutation SaveWebhooks($input: WebhookInput!) {
    saveWebhooks(input: $input) { id scope endpoint }
  }
`;
