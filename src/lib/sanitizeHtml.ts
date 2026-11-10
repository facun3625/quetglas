// Contenido que viene del RichTextEditor del admin (Mailing, pop-up) — es de
// un admin logueado, no de un visitante, pero igual se limpia: sacar
// <script>/<style>/<iframe>/etc. y atributos on* evita que un pegado de
// contenido de otra página (o un editor con bugs) arrastre algo raro al mail
// o al sitio público. No es un sanitizador HTML completo — para eso haría
// falta parsear el DOM de verdad, que no está disponible del lado del server
// sin sumar una dependencia — pero cubre lo que puede pasar en la práctica.
export function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\shref\s*=\s*(["'])\s*javascript:[^"']*\1/gi, "")
    // Las imágenes que inserta el editor no traen estilo — se les agrega acá
    // para que no se salgan del ancho del contenedor.
    .replace(/<img(?![^>]*\bstyle=)([^>]*)>/gi, '<img$1 style="max-width:100%;height:auto;border-radius:8px;" />')
    // Los links del editor tampoco traen color — se les da el color de marca (sin
    // subrayado: el estilo de los links vive en .rich-content a, ver globals.css).
    .replace(
      /<a(?![^>]*\bstyle=)([^>]*)>/gi,
      '<a$1 style="color:#c4161a;text-decoration:none;">'
    );
}
