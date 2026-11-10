import { getContactCards } from "@/lib/contactCards";
import { resolveContact } from "@/lib/contactInfo";
import { prisma } from "@/lib/prisma";
import { getAllCategories } from "@/lib/categories";
import { searchProductsForAssistant } from "@/lib/products";
import { getAllShippingMethods } from "@/lib/shipping";
import { optionalNumber, optionalText, safeToolArgs } from "@/lib/ai/validation";
import type { AssistantProduct } from "@/lib/ai/types";
import { getHumanSellerAvailability } from "@/lib/ai/availability";
import { storeNameOf } from "@/lib/storeName";
import {
  DEFAULT_FRANCHISE_LOCATION,
} from "@/lib/contact";

export type AssistantToolName = "search_products" | "list_categories" | "get_store_options";

export type AssistantToolDefinition = {
  name: AssistantToolName;
  description: string;
  parameters: Record<string, unknown>;
};

export const ASSISTANT_TOOLS: AssistantToolDefinition[] = [
  {
    name: "search_products",
    description:
      "Busca productos vendibles en el catálogo real de la tienda. Usala antes de recomendar o afirmar precio y stock.",
    parameters: {
      type: "object",
      properties: {
        query: { type: ["string", "null"], description: "Palabras presentes en el nombre del producto." },
        category_id: { type: ["string", "null"], description: "ID de categoría obtenido con list_categories." },
        min_price: { type: ["number", "null"], description: "Precio mínimo en pesos argentinos." },
        max_price: { type: ["number", "null"], description: "Precio máximo en pesos argentinos." },
        in_stock_only: { type: "boolean", description: "Usar true salvo que el cliente pregunte por productos agotados." },
      },
      required: ["query", "category_id", "min_price", "max_price", "in_stock_only"],
      additionalProperties: false,
    },
  },
  {
    name: "list_categories",
    description: "Lista categorías reales de la tienda para orientar una búsqueda de productos.",
    parameters: {
      type: "object",
      properties: {
        query: { type: ["string", "null"], description: "Texto opcional para filtrar categorías por nombre." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_store_options",
    description:
      "Consulta la información oficial y vigente de la tienda: nombre, sucursal, dirección, contacto, Instagram, WhatsApp, horarios de atención, medios de pago, descuentos y métodos de envío. Usala antes de responder cualquier pregunta sobre el negocio o sus condiciones de compra.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia bancaria",
  contra_entrega: "Contra entrega",
  payway: "Tarjeta de crédito o débito",
};

function productDto(product: Awaited<ReturnType<typeof searchProductsForAssistant>>[number]): AssistantProduct {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    available: product.stock,
    categoryId: product.categoryId ?? undefined,
    categoryName: product.categoryName ?? undefined,
    image: product.thumb,
    type: product.type,
    href: `/producto/${product.slug}`,
  };
}

export async function executeAssistantTool(
  name: string,
  rawArgs: unknown,
): Promise<{ output: string; products?: AssistantProduct[] }> {
  const args = safeToolArgs(rawArgs);

  if (name === "search_products") {
    const products = (
      await searchProductsForAssistant({
        query: optionalText(args.query, 80),
        categoryId: optionalText(args.category_id, 64),
        minPrice: optionalNumber(args.min_price),
        maxPrice: optionalNumber(args.max_price),
        inStockOnly: args.in_stock_only !== false,
        limit: 6,
      })
    ).map(productDto);
    return {
      products,
      output: JSON.stringify({
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          available: product.available,
          categoryId: product.categoryId,
          categoryName: product.categoryName,
        })),
        count: products.length,
      }),
    };
  }

  if (name === "list_categories") {
    const query = optionalText(args.query, 80)?.toLocaleLowerCase("es") ?? "";
    const categories = (await getAllCategories())
      .filter((category) => !query || category.name.toLocaleLowerCase("es").includes(query))
      .slice(0, 40)
      .map((category) => ({ id: category.id, name: category.name }));
    return { output: JSON.stringify({ categories }) };
  }

  if (name === "get_store_options") {
    const [payments, shipping, settings] = await Promise.all([
      prisma.paymentMethodConfig.findMany({
        where: { enabled: true },
        select: {
          method: true,
          discountPct: true,
          bankCbu: true,
          bankAlias: true,
          bankHolderName: true,
          allowedShipping: {
            select: { shippingMethod: { select: { name: true, enabled: true } } },
          },
        },
      }),
      getAllShippingMethods(),
      prisma.storeSettings.findUnique({ where: { id: "global" } }),
    ]);
    const cards = await getContactCards();
    const contact = resolveContact(settings ?? {}, cards, settings?.franchiseLocation?.trim() || DEFAULT_FRANCHISE_LOCATION);
    const humanSupport = getHumanSellerAvailability({
      franchiseName: settings?.franchiseName,
      aiHumanHandoffEnabled: settings?.aiHumanHandoffEnabled ?? true,
      aiHumanDays: settings?.aiHumanDays ?? [1, 2, 3, 4, 5, 6],
      aiHumanStartTime: settings?.aiHumanStartTime ?? "09:00",
      aiHumanEndTime: settings?.aiHumanEndTime ?? "18:00",
      whatsappPhone: contact.whatsappNumber,
    });
    return {
      output: JSON.stringify({
        store: {
          name: storeNameOf(settings),
          branch: settings?.franchiseLocation?.trim() || DEFAULT_FRANCHISE_LOCATION,
          address: contact.address || undefined,
          // Cada local con su dirección, teléfono, WhatsApp e Instagram (las tarjetas de Contacto)
          locations: cards.map((c) => ({ name: c.title, address: c.address, phone: c.phone, whatsapp: c.whatsapp, instagram: c.instagram })),
          contactEmail: contact.contactEmail || undefined,
          instagram: contact.instagramHandle ? `@${contact.instagramHandle}` : undefined,
          whatsapp: contact.whatsappNumber || undefined,
        },
        paymentMethods: payments.map((payment) => ({
          name: PAYMENT_LABELS[payment.method] ?? payment.method,
          generalDiscountPct: payment.discountPct,
          allowedShippingMethods:
            payment.allowedShipping.length > 0
              ? payment.allowedShipping
                  .filter((item) => item.shippingMethod.enabled)
                  .map((item) => item.shippingMethod.name)
              : shipping.filter((method) => method.enabled).map((method) => method.name),
          ...(payment.method === "transferencia"
            ? {
                transferDetails: {
                  cbu: payment.bankCbu,
                  alias: payment.bankAlias,
                  holder: payment.bankHolderName,
                },
              }
            : {}),
        })),
        shippingMethods: shipping
          .filter((method) => method.enabled)
          .map((method) => ({
            name: method.name,
            cost: method.cost,
            description: method.description,
            requiresAddress: method.requiresAddress,
          })),
        humanSupport: {
          available: humanSupport.available,
          schedule: humanSupport.scheduleText,
          whatsappUrl: humanSupport.whatsappUrl,
        },
      }),
    };
  }

  return { output: JSON.stringify({ error: "Herramienta desconocida" }) };
}
