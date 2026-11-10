import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server Actions (crear/editar hero slides, comprobantes de transferencia)
  // suben imágenes como multipart/form-data — el límite por defecto de 1MB
  // es demasiado chico para fotos reales. Nginx ya acepta hasta 50MB
  // (client_max_body_size), esto destraba el límite propio de Next.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // URLs típicas de WooCommerce -> las nuevas (redirección permanente, conserva el posicionamiento).
  // Los productos conservan el slug de Woo; las categorías se resuelven por slug.
  async redirects() {
    return [
      { source: "/product/:slug", destination: "/producto/:slug", permanent: true },
      { source: "/categoria-producto/:path*", destination: "/categoria/:path*", permanent: true },
      { source: "/product-category/:path*", destination: "/categoria/:path*", permanent: true },
      { source: "/shop", destination: "/tienda", permanent: true },
      { source: "/tienda-online", destination: "/tienda", permanent: true },
      { source: "/cart", destination: "/carrito", permanent: true },
      { source: "/my-account", destination: "/mi-cuenta/pedidos", permanent: true },
      { source: "/mi-cuenta", destination: "/mi-cuenta/pedidos", permanent: false },
    ];
  },
};

export default nextConfig;
