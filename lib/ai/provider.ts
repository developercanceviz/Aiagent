import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

/**
 * Provider-agnostic LLM wrapper. Keep all provider/model selection here so the
 * rest of the app never imports a provider directly — swapping is a one-file
 * (or zero-file, via env) change.
 *
 * Selection: AI_PROVIDER=anthropic|openai wins if set; otherwise whichever
 * API key exists (Anthropic preferred when both do).
 *
 * Roles: `chat` = the customer/merchant conversational model; `classifier` =
 * a small, cheap model for intent/routing. OpenAI model ids are overridable
 * via OPENAI_CHAT_MODEL / OPENAI_CLASSIFIER_MODEL without a code change.
 */

type Provider = "anthropic" | "openai";

function activeProvider(): Provider {
  const forced = process.env.AI_PROVIDER;
  if (forced === "openai" || forced === "anthropic") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "anthropic";
}

const modelIds = {
  anthropic: {
    chat: "claude-sonnet-4-6",
    classifier: "claude-haiku-4-5-20251001",
  },
  openai: {
    chat: process.env.OPENAI_CHAT_MODEL ?? "gpt-5.1",
    classifier: process.env.OPENAI_CLASSIFIER_MODEL ?? "gpt-5-mini",
  },
} as const;

export type ModelRole = "chat" | "classifier";

export function getModel(role: ModelRole = "chat") {
  const provider = activeProvider();
  const id = modelIds[provider][role];
  return provider === "openai" ? openai(id) : anthropic(id);
}

/** For usage/cost tracking and diagnostics. */
export function getModelId(role: ModelRole = "chat"): string {
  return modelIds[activeProvider()][role];
}
