import "server-only";
import type { AiProvider } from "@/generated/prisma/enums";
import { runGeminiAssistant } from "@/lib/ai/providers/gemini";
import { runOpenAiAssistant } from "@/lib/ai/providers/openai";
import type { AssistantProviderInput } from "@/lib/ai/types";

export async function runAssistantProvider(provider: AiProvider, input: AssistantProviderInput) {
  return provider === "gemini" ? runGeminiAssistant(input) : runOpenAiAssistant(input);
}
