// Canonical Product/Category/Variant contracts now live in @minirue/contracts
// (packages/contracts/src/catalog.ts) so frontend and dashboard can't drift
// again. Re-exported here so existing imports of './types' keep working.
export type {
  ProductStatus,
  BottleType,
  Gender,
  Category,
  ProductVariant,
  ProductMedia,
  ProductListItem,
  Product,
} from '@minirue/contracts';
