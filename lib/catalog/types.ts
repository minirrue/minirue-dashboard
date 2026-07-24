export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'PUBLISHED';

// Gender was a hardcoded union here and a hardcoded array in two page files.
// It is an admin-managed option list now (specs 2026-07-22-product-tree), so
// there is nothing left to hardcode.

/** A named option list the admin owns, e.g. Concentration, Gender, Shade. */
/**
 * A global variant: a named list, its values, and the categories it applies to.
 * Products in those categories get it as a field on each variant they add.
 */
export interface AttributeRecord {
  id: string;
  name: string;
  /** Categories it applies to. Empty = offered in every category. */
  categoryIds: string[];
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

/** One VARIANT-list answer, resolved to names. */
export interface VariantValue {
  attributeId: string;
  attributeName: string;
  optionId: string;
  optionName: string;
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
  /** @deprecated pre-0010 rows only; size is an option-list answer now. */
  size: number | null;
  /** @deprecated pre-0010 rows only. */
  sizeMl: number | null;
  /** This variant's answers to the global variants for its category. */
  values: VariantValue[];
  /** Product-specific custom fields: { "Field name": "value" }. Optional so
   *  existing fixtures/callers need not set it; mapVariant always fills it. */
  customValues?: Record<string, string>;
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
  /** COVER = the thumbnail shoppers see outside the product (grids, cart, share
   * previews). CAROUSEL = the images inside the product's gallery. Exactly one
   * COVER per product; the first image uploaded becomes it automatically. */
  role: 'COVER' | 'CAROUSEL';
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
  variants: ProductVariant[];
  media: ProductMedia[];
  createdAt: string;
  updatedAt: string;
}
