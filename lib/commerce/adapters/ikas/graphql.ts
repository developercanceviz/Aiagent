/**
 * Minimal typed GraphQL client for the ikas Admin API. We POST hand-written
 * queries to https://api.myikas.com/api/v2/admin/graphql with a Bearer token.
 *
 * NOTE (Phase 1 verification): the exact field names below follow the ikas
 * Admin API (listOrder / listProduct / listCustomer with `data` + pagination).
 * Validate against live GraphQL codegen once credentials are available — these
 * selections are the spots to double-check.
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
        billingAddress { city }
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
          stockCount
          prices { sellPrice currency }
        }
        images { imageId order }
        url
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

export const SAVE_WEBHOOK = /* GraphQL */ `
  mutation SaveWebhook($input: WebhookInput!) {
    saveWebhook(input: $input) { id scope endpoint }
  }
`;
