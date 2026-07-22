export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'PUBLISHED';

// Gender was a hardcoded union here and a hardcoded array in two page files.
// It is an admin-managed option list now (specs 2026-07-22-product-tree), so
// there is nothing left to hardcode.

/** A named option list the admin owns, e.g. Concentration, Gender, Shade. */
export interface AttributeRecord {
  id: string;
  name: string;
  /** null = offered in every category. */
  categoryId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AttributeOptionRecord {
  id: string;
  attributeId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

/** One of an item's picks, already resolved to names for display. */
export interface ProductAttributeValue {
  attributeId: string;
  attributeName: string;
  optionId: string;
  optionName: string;
}

/** A reusable variant defined on a brand and copied onto its items. */
export interface BrandGlobalVariant {
  id: string;
  brandId: string;
  label: string;
  sizeMl: number | null;
  defaultPriceAmount: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** One node of the Category -> Brand -> Item navigation tree. */
export interface TreeBrandNode {
  brandId: string;
  brandName: string;
  itemCount: number;
}

export interface TreeCategoryNode {
  categoryId: string;
  categoryName: string;
  itemCount: number;
  brands: TreeBrandNode[];
}

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
  /** Set when copied from a brand global; null for a one-off custom variant. */
  sourceGlobalVariantId: string | null;
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
  brandId: string;
  brandName: string;
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
  /** Level 2 of the tree. */
  brandId: string;
  brandName: string;
  description: string;
  status: ProductStatus;
  basePrice: number;
  /** Level 1 of the tree. Exactly one — not a list. */
  categoryId: string;
  categoryName: string;
  /** Replaces the old free-text gender and fragranceFamily fields. */
  attributes: ProductAttributeValue[];
  variants: ProductVariant[];
  media: ProductMedia[];
  createdAt: string;
  updatedAt: string;
}
