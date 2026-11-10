import { GoogleGenAI } from "@google/genai";
import { ASSISTANT_TOOLS, executeAssistantTool } from "@/lib/ai/tools";
import type { AssistantProduct, AssistantProviderInput, AssistantReply } from "@/lib/ai/types";

const tools = ASSISTANT_TOOLS.map((tool) => ({
  type: "function" as const,
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
}));

function transcript(input: AssistantProviderInput): string {
  return input.history
    .map((message) => `${message.role === "user" ? "Cliente" : "Vendedora"}: ${message.content}`)
    .join("\n\n");
}

export async function runGeminiAssistant(input: AssistantProviderInput): Promise<AssistantReply> {
  const client = new GoogleGenAI({ apiKey: input.apiKey });
  const requestConfig = {
    model: input.model,
    system_instruction: input.instructions,
    tools,
    store: false,
    generation_config: { thinking_level: "low" as const, max_output_tokens: 600 },
  };
  let interaction = await client.interactions.create({ ...requestConfig, input: transcript(input) });
  let products: AssistantProduct[] = [];
  let tokens = interaction.usage?.total_tokens ?? 0;

  for (let round = 0; round < 4; round += 1) {
    const calls = (interaction.steps ?? []).filter((step) => step.type === "function_call");
    if (calls.length === 0) {
      return {
        text: interaction.output_text?.trim() || "No pude armar una respuesta. Probá reformulando la consulta.",
        products,
        tokens,
      };
    }

    const functionResults = await Promise.all(
      calls.map(async (call) => {
        try {
          const result = await executeAssistantTool(call.name, call.arguments);
          if (result.products) products = result.products;
          return {
            type: "function_result" as const,
            name: call.name,
            call_id: call.id,
            result: result.output,
          };
        } catch (error) {
          console.error("AI tool failed", call.name, error);
          return {
            type: "function_result" as const,
            name: call.name,
            call_id: call.id,
            is_error: true,
            result: JSON.stringify({ error: "No se pudo consultar esa información" }),
          };
        }
      }),
    );
    interaction = await client.interactions.create({
      ...requestConfig,
      input: [...(interaction.steps ?? []), ...functionResults],
    });
    tokens += interaction.usage?.total_tokens ?? 0;
  }

  return { text: "No pude completar la búsqueda. Probá con una consulta más específica.", products, tokens };
}
