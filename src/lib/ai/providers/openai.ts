import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { ASSISTANT_TOOLS, executeAssistantTool } from "@/lib/ai/tools";
import type { AssistantProduct, AssistantProviderInput, AssistantReply } from "@/lib/ai/types";

const tools: FunctionTool[] = ASSISTANT_TOOLS.map((tool) => ({
  type: "function",
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters,
  strict: true,
}));

export async function runOpenAiAssistant(input: AssistantProviderInput): Promise<AssistantReply> {
  const client = new OpenAI({ apiKey: input.apiKey });
  let responseInput: ResponseInputItem[] = input.history.map((message) => ({
    type: "message",
    role: message.role,
    content: message.content,
  }));
  let products: AssistantProduct[] = [];
  let tokens = 0;

  for (let round = 0; round < 4; round += 1) {
    const response = await client.responses.create({
      model: input.model,
      instructions: input.instructions,
      input: responseInput,
      tools,
      store: false,
      max_output_tokens: 600,
    });
    tokens += response.usage?.total_tokens ?? 0;
    const calls = response.output.filter(
      (item): item is ResponseFunctionToolCall => item.type === "function_call",
    );
    if (calls.length === 0) {
      return {
        text: response.output_text.trim() || "No pude armar una respuesta. Probá reformulando la consulta.",
        products,
        tokens,
      };
    }

    const toolResults = await Promise.all(
      calls.map(async (call) => {
        try {
          const result = await executeAssistantTool(call.name, JSON.parse(call.arguments));
          if (result.products) products = result.products;
          return { type: "function_call_output" as const, call_id: call.call_id, output: result.output };
        } catch (error) {
          console.error("AI tool failed", call.name, error);
          return {
            type: "function_call_output" as const,
            call_id: call.call_id,
            output: JSON.stringify({ error: "No se pudo consultar esa información" }),
          };
        }
      }),
    );
    responseInput = [...responseInput, ...toResponseInputItems(response.output), ...toolResults];
  }

  return { text: "No pude completar la búsqueda. Probá con una consulta más específica.", products, tokens };
}
