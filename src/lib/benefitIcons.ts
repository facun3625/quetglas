import type { LucideIcon } from "lucide-react";
import {
  Award, Baby, Backpack, Banknote, BadgeCheck, BadgePercent, Bike, Book, Box, Brush, Building2, Cake, Calendar, Camera, Car, Check, CircleCheck, Clock,
  CreditCard, Crown, Flame, Gem, Gift, Globe, Hammer, Handshake, HandHeart, Headphones, Heart, House, Landmark, Leaf, Lock, Mail, MapPin, MessageCircle, Music,
  Package, Palette, PartyPopper, Phone, Plane, Puzzle, QrCode, Recycle, RefreshCw, Rocket, Ruler, Scissors, Settings, Shield, ShieldCheck, Shirt, ShoppingBag, ShoppingCart,
  Smartphone, Smile, Snowflake, Sparkles, Star, Store, Sun, Tag, Thermometer, ThumbsUp, Timer, Truck, Undo2, Users, Wallet, Wrench, Zap,
} from "lucide-react";

// Íconos para la franja de beneficios del inicio (librería Lucide). `key` es lo que se guarda; `keywords` sirven para el buscador.
// Las claves viejas (TagIcon, TruckIcon, …) siguen funcionando: se traducen con LEGACY_KEYS.
export type BenefitIcon = { key: string; label: string; keywords: string; Icon: LucideIcon };

export const BENEFIT_ICONS: BenefitIcon[] = [
  { key: "truck", label: "Envíos", keywords: "camion entrega delivery reparto", Icon: Truck },
  { key: "package", label: "Paquete", keywords: "caja pedido encomienda", Icon: Package },
  { key: "box", label: "Caja", keywords: "paquete producto", Icon: Box },
  { key: "store", label: "Local", keywords: "tienda negocio retiro sucursal", Icon: Store },
  { key: "building", label: "Edificio", keywords: "local sucursal empresa", Icon: Building2 },
  { key: "house", label: "Casa", keywords: "hogar domicilio", Icon: House },
  { key: "map-pin", label: "Ubicación", keywords: "direccion mapa lugar", Icon: MapPin },
  { key: "credit-card", label: "Tarjeta", keywords: "pago cuotas credito debito", Icon: CreditCard },
  { key: "wallet", label: "Billetera", keywords: "pago dinero", Icon: Wallet },
  { key: "banknote", label: "Efectivo", keywords: "dinero plata billete contado", Icon: Banknote },
  { key: "landmark", label: "Banco", keywords: "transferencia", Icon: Landmark },
  { key: "tag", label: "Etiqueta", keywords: "precio oferta descuento", Icon: Tag },
  { key: "percent", label: "Descuento", keywords: "oferta porcentaje promo", Icon: BadgePercent },
  { key: "gift", label: "Regalo", keywords: "sorpresa obsequio", Icon: Gift },
  { key: "shopping-bag", label: "Bolsa de compras", keywords: "comprar tienda", Icon: ShoppingBag },
  { key: "shopping-cart", label: "Carrito", keywords: "comprar", Icon: ShoppingCart },
  { key: "clock", label: "Reloj", keywords: "horario hora rapido", Icon: Clock },
  { key: "timer", label: "Cronómetro", keywords: "rapido tiempo", Icon: Timer },
  { key: "calendar", label: "Calendario", keywords: "fecha dia", Icon: Calendar },
  { key: "zap", label: "Rayo", keywords: "rapido energia", Icon: Zap },
  { key: "rocket", label: "Cohete", keywords: "rapido lanzamiento", Icon: Rocket },
  { key: "shield-check", label: "Compra segura", keywords: "seguridad proteccion garantia", Icon: ShieldCheck },
  { key: "shield", label: "Escudo", keywords: "seguro proteccion", Icon: Shield },
  { key: "lock", label: "Candado", keywords: "seguro privado", Icon: Lock },
  { key: "badge-check", label: "Verificado", keywords: "garantia calidad", Icon: BadgeCheck },
  { key: "check-circle", label: "Check", keywords: "ok listo tilde", Icon: CircleCheck },
  { key: "check", label: "Tilde", keywords: "ok", Icon: Check },
  { key: "award", label: "Premio", keywords: "calidad medalla", Icon: Award },
  { key: "star", label: "Estrella", keywords: "favorito destacado", Icon: Star },
  { key: "heart", label: "Corazón", keywords: "amor favorito", Icon: Heart },
  { key: "hand-heart", label: "Atención con cariño", keywords: "servicio ayuda", Icon: HandHeart },
  { key: "handshake", label: "Acuerdo", keywords: "confianza trato", Icon: Handshake },
  { key: "smile", label: "Sonrisa", keywords: "feliz clientes", Icon: Smile },
  { key: "thumbs-up", label: "Me gusta", keywords: "recomendado", Icon: ThumbsUp },
  { key: "sparkles", label: "Brillos", keywords: "novedad nuevo magia", Icon: Sparkles },
  { key: "crown", label: "Corona", keywords: "premium vip", Icon: Crown },
  { key: "gem", label: "Joya", keywords: "bijouterie accesorio diamante", Icon: Gem },
  { key: "party", label: "Fiesta", keywords: "cotillon cumpleaños celebracion", Icon: PartyPopper },
  { key: "cake", label: "Torta", keywords: "reposteria cumpleaños", Icon: Cake },
  { key: "baby", label: "Bebé", keywords: "baby shower infantil", Icon: Baby },
  { key: "puzzle", label: "Juego", keywords: "didactico juguete", Icon: Puzzle },
  { key: "palette", label: "Paleta", keywords: "manualidades arte pintura", Icon: Palette },
  { key: "brush", label: "Pincel", keywords: "manualidades arte", Icon: Brush },
  { key: "scissors", label: "Tijera", keywords: "manualidades corte", Icon: Scissors },
  { key: "ruler", label: "Regla", keywords: "medida", Icon: Ruler },
  { key: "shirt", label: "Remera", keywords: "disfraz ropa", Icon: Shirt },
  { key: "backpack", label: "Mochila", keywords: "escolar", Icon: Backpack },
  { key: "book", label: "Libro", keywords: "libreria", Icon: Book },
  { key: "music", label: "Música", keywords: "sonido", Icon: Music },
  { key: "camera", label: "Cámara", keywords: "foto", Icon: Camera },
  { key: "flame", label: "Fuego", keywords: "oferta caliente hot", Icon: Flame },
  { key: "sun", label: "Sol", keywords: "verano", Icon: Sun },
  { key: "snowflake", label: "Nieve", keywords: "invierno frio navidad", Icon: Snowflake },
  { key: "thermometer", label: "Temperatura", keywords: "calor frio", Icon: Thermometer },
  { key: "leaf", label: "Hoja", keywords: "natural ecologico", Icon: Leaf },
  { key: "recycle", label: "Reciclable", keywords: "ecologico", Icon: Recycle },
  { key: "refresh", label: "Cambios", keywords: "devolucion cambio", Icon: RefreshCw },
  { key: "undo", label: "Devoluciones", keywords: "cambio garantia", Icon: Undo2 },
  { key: "headphones", label: "Atención", keywords: "soporte ayuda contacto", Icon: Headphones },
  { key: "message", label: "WhatsApp / chat", keywords: "mensaje consulta whatsapp", Icon: MessageCircle },
  { key: "phone", label: "Teléfono", keywords: "llamar contacto", Icon: Phone },
  { key: "smartphone", label: "Celular", keywords: "telefono whatsapp", Icon: Smartphone },
  { key: "mail", label: "Email", keywords: "correo", Icon: Mail },
  { key: "users", label: "Clientes", keywords: "equipo gente", Icon: Users },
  { key: "globe", label: "Todo el país", keywords: "mundo internet online", Icon: Globe },
  { key: "plane", label: "Avión", keywords: "importado envio", Icon: Plane },
  { key: "car", label: "Auto", keywords: "reparto cadete", Icon: Car },
  { key: "bike", label: "Bici", keywords: "cadete reparto", Icon: Bike },
  { key: "qr", label: "QR", keywords: "codigo pago", Icon: QrCode },
  { key: "wrench", label: "Herramienta", keywords: "servicio arreglo", Icon: Wrench },
  { key: "hammer", label: "Martillo", keywords: "herramientas", Icon: Hammer },
  { key: "settings", label: "Engranaje", keywords: "ajustes", Icon: Settings },
];

// Claves del selector anterior → su equivalente en la librería
export const LEGACY_KEYS: Record<string, string> = {
  TagIcon: "tag", TruckIcon: "truck", StoreIcon: "store", CardIcon: "credit-card", PackageIcon: "package", ClockIcon: "clock",
  CheckCircleIcon: "check-circle", StarIcon: "star", HeartIcon: "heart", GearIcon: "settings", MapPinIcon: "map-pin", HomeIcon: "house",
};

export function resolveBenefitIcon(key: string | null | undefined): BenefitIcon {
  const k = (key && LEGACY_KEYS[key]) || key;
  return BENEFIT_ICONS.find((i) => i.key === k) ?? BENEFIT_ICONS.find((i) => i.key === "tag")!;
}

export type HomeBenefit = { icon: string; title: string; subtitle: string };
export const MAX_BENEFITS = 6;

// Lo que llega del panel o de la base: se deja solo lo válido (ícono conocido, textos con largo máximo, hasta 6 ítems)
export function sanitizeBenefits(input: unknown): HomeBenefit[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim().slice(0, 80) : "";
      const subtitle = typeof o.subtitle === "string" ? o.subtitle.trim().slice(0, 120) : "";
      const icon = typeof o.icon === "string" ? resolveBenefitIcon(o.icon).key : "tag";
      return { icon, title, subtitle };
    })
    .filter((b) => b.title || b.subtitle)
    .slice(0, MAX_BENEFITS);
}
