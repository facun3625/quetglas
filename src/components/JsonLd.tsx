// Datos estructurados (schema.org) para buscadores. El JSON se escapa para que un "</script>"
// dentro de un texto del catálogo no pueda cerrar la etiqueta.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
