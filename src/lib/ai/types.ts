export type AssistantHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantProduct = {
  id: string;
  name: string;
  price: number;
  available: number;
  categoryId?: string;
  categoryName?: string;
  // URL de la miniatura del producto
  image: string | null;
  type?: "simple" | "variable";
  href: string;
};

export type AssistantReply = {
  text: string;
  products: AssistantProduct[];
  // Tokens que consumió la respuesta (todas las vueltas con el proveedor); se restan del cupo mensual de IA
  tokens: number;
};

export type AssistantProviderInput = {
  apiKey: string;
  model: string;
  instructions: string;
  history: AssistantHistoryMessage[];
};

export const DEFAULT_AI_MODELS = {
  openai: "gpt-5.6-luna",
  gemini: "gemini-3.8-flash",
} as const;
