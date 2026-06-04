export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'PUBLISHED';
export type BottleType = 'EDP' | 'EDT' | 'EAU_DE_COLOGNE' | 'PERFUME_OIL' | 'spray' | 'splash' | 'travel' | 'refill';
export type Gender = 'MASCULINE' | 'FEMININE' | 'UNISEX' | 'men' | 'women' | 'unisex';

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children?: Category[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  size: number;
  sizeMl: number;
  bottleType: BottleType;
  price: number;
  priceAmount: number;
  currency: string;
  stock: number;
}

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  status: ProductStatus;
  variantCount: number;
  basePrice: number;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  createdAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  fragranceFamily: string | null;
  gender: Gender;
  status: ProductStatus;
  basePrice: number;
  categoryId: string | null;
  category: Category | null;
  categories: Category[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}
