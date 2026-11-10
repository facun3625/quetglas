// Subconjunto de la API REST v3 de WooCommerce que usa el migrador.
export type WooImage = { id: number; src: string; alt?: string; name?: string };

export type WooCategory = {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description?: string;
  menu_order?: number;
  count?: number;
  image: WooImage | null;
};

export type WooAttribute = { id: number; name: string; slug: string };
export type WooTerm = { id: number; name: string; slug: string; menu_order?: number };

export type WooProductAttribute = {
  id: number; // 0 = atributo local del producto
  name: string;
  position?: number;
  visible?: boolean;
  variation?: boolean;
  options: string[];
};

export type WooProduct = {
  id: number;
  name: string;
  slug: string;
  type: string; // simple | variable | grouped | external
  status: string; // publish | draft | pending | private
  featured?: boolean;
  description?: string;
  short_description?: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  on_sale?: boolean;
  manage_stock?: boolean | "parent";
  stock_quantity?: number | null;
  stock_status?: string; // instock | outofstock | onbackorder
  weight?: string;
  dimensions?: { length?: string; width?: string; height?: string };
  categories?: { id: number; name?: string }[];
  images?: WooImage[];
  attributes?: WooProductAttribute[];
  variations?: number[];
};

export type WooVariation = {
  id: number;
  status?: string;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  price?: string;
  on_sale?: boolean;
  manage_stock?: boolean | "parent";
  stock_quantity?: number | null;
  stock_status?: string;
  weight?: string;
  dimensions?: { length?: string; width?: string; height?: string };
  image?: WooImage | null;
  attributes?: { id: number; name: string; option: string }[];
};

export type WooCustomer = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  billing?: { first_name?: string; last_name?: string; phone?: string };
};
