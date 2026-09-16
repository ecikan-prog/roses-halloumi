/**
 * Product weight lookup used purely for shipping calculations.
 *
 * The Product model does not (yet) have a dedicated `weightKg` column, so —
 * matching the same name-based matching already used elsewhere for the three
 * retail Halloumi products (see scripts/fix-halloumi-products.ts) — weight is
 * derived from the product name. If a real `weightKg` column is added to the
 * schema later, this lookup can be replaced with `product.weightKg` directly
 * without changing any of the shipping calculation logic below.
 */

export const HALLOUMI_WEIGHT_KG_BY_NAME: Record<string, number> = {
  'Grassland Cheese Halloumi — 1kg': 1.0,
  'Grassland Cheese Halloumi — 500g': 0.5,
  'Grassland Cheese Halloumi — 200g': 0.2,
};

/**
 * Returns the per-unit weight (in kilograms) for a product name. Falls back to
 * parsing a leading "<number><kg|g>" pattern out of the name/unit so any future
 * product still gets a sensible weight instead of silently being treated as 0kg.
 */
export function getProductWeightKg(product: { name: string; unit?: string | null }): number {
  const exact = HALLOUMI_WEIGHT_KG_BY_NAME[product.name];

  if (typeof exact === 'number') {
    return exact;
  }

  const source = `${product.name} ${product.unit ?? ''}`;
  const match = source.match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/i);

  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit === 'kg' ? value : value / 1000;
}
