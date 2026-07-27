import { anthropic } from "@ai-sdk/anthropic";

/**
 * Provider-agnostic LLM wrapper. Default provider = Anthropic Claude. Keep all
 * model selection here so the rest of the app never imports a provider directly
 * — swapping providers (or models) is a one-file change.
 *
 * Model IDs follow Anthropic's latest naming. `chat` = the customer/merchant
 * conversational model; `classifier` = a small, cheap model for intent/routing.
 */
export const models = {
  chat: anthropic("claude-sonnet-4-6"),
  classifier: anthropic("claude-haiku-4-5-20251001"),
} as const;

export type ModelRole = keyof typeof models;

export function getModel(role: ModelRole = "chat") {
  return models[role];
}
