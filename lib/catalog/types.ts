export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'PUBLISHED';
export type BottleType = 'EDP' | 'EDT' | 'Parfum' | 'Hair Mist' | 'spray' | 'splash' | 'travel' | 'refill';
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

export interface ProductMedia {
  id: string;
  cloudinaryPublicId: string;
  // Added for the Gallery module (specs/006-gallery-module, US2): set when
  // this media row was selected from Gallery rather than pasted in as a
  // Cloudinary public ID. `url` is the resolved gallery URL, only present on
  // the response right after creation (see lib/catalog/api.ts).
  galleryItemId: string | null;
  // Added for the Gallery module (specs/006-gallery-module, US3): when set,
  // this row is scoped to a single product variant; NULL = general
  // product-level image, shown as the fallback for variants with no
  // photos of their own (spec Acceptance Scenario 3).
  variantId: string | null;
  url?: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  sortOrder: number;
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
  media: ProductMedia[];
  createdAt: string;
  updatedAt: string;
}
