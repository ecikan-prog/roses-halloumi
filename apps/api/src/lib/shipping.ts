/**
 * Shipping calculation service.
 *
 * IMPORTANT: We do not yet have a real courier/rate table for Grassland
 * Cheese. Everything in `TEMPORARY_RATE_TABLE` below is a clearly-labelled
 * PLACEHOLDER so the checkout has *something* structured to calculate from
 * instead of a single hard-coded flat fee. It must be replaced with the real
 * courier rates before this goes live for paying customers — do not treat
 * these numbers as final pricing.
 *
 * The shape of `calculateShipping` is intentionally the long-term contract:
 * it takes a destination and a total shipment weight and returns a charge.
 * When real rates are supplied, only `TEMPORARY_RATE_TABLE` (and the zone
 * lookup) need to change — the checkout UI and the orders router do not need
 * to be rewritten.
 */

export type ShippingDestination = {
  country: string;
  region?: string | null;
  city?: string | null;
  postcode?: string | null;
  /** Set true if the destination is known to be rural/remote for surcharge purposes. */
  isRural?: boolean;
};

export type ShippingCalculationInput = {
  destination: ShippingDestination;
  /** Total shipment weight in kilograms (sum of productWeightKg * qty across the cart). */
  totalWeight: number;
};

export type ShippingZone = 'NZ_METRO' | 'NZ_RURAL' | 'INTERNATIONAL';

export type ShippingCalculationResult = {
  amount: number;
  currency: 'NZD';
  zone: ShippingZone;
  weightBandLabel: string;
  /**
   * True while `TEMPORARY_RATE_TABLE` is in use. Callers (checkout UI, emails)
   * should surface this so nobody mistakes the placeholder for a final rate.
   */
  isTemporaryRate: boolean;
  freeShippingApplied: boolean;
};

type WeightBand = {
  label: string;
  /** Upper bound (kg), inclusive. Use Infinity for the last band. */
  maxWeightKg: number;
  ratesByZone: Record<ShippingZone, number>;
};

/**
 * TEMPORARY placeholder weight bands / zone rates (NZD). Replace with the
 * actual courier rate card when it is supplied — see module comment above.
 */
const TEMPORARY_RATE_TABLE: WeightBand[] = [
  { label: 'Up to 1kg', maxWeightKg: 1, ratesByZone: { NZ_METRO: 6.5, NZ_RURAL: 9.5, INTERNATIONAL: 25 } },
  { label: '1kg – 3kg', maxWeightKg: 3, ratesByZone: { NZ_METRO: 8.5, NZ_RURAL: 12.5, INTERNATIONAL: 40 } },
  { label: '3kg – 5kg', maxWeightKg: 5, ratesByZone: { NZ_METRO: 11.5, NZ_RURAL: 16.5, INTERNATIONAL: 55 } },
  { label: 'Over 5kg', maxWeightKg: Infinity, ratesByZone: { NZ_METRO: 15.5, NZ_RURAL: 22.5, INTERNATIONAL: 75 } },
];

/** Placeholder rural surcharge trigger. Configure real rural postcode/region logic when supplied. */
const RURAL_REGION_KEYWORDS = ['rural', 'remote', 'island'];

/** Placeholder free-shipping threshold; set to null to disable free shipping entirely. */
const TEMPORARY_FREE_SHIPPING_THRESHOLD_NZD: number | null = null;

function normalizeCountry(country: string) {
  return country.trim().toLowerCase();
}

function isNewZealand(country: string) {
  const normalized = normalizeCountry(country);
  return normalized === 'nz' || normalized === 'new zealand' || normalized === 'aotearoa';
}

function resolveZone(destination: ShippingDestination): ShippingZone {
  if (!isNewZealand(destination.country)) {
    return 'INTERNATIONAL';
  }

  const regionText = `${destination.region ?? ''} ${destination.city ?? ''}`.toLowerCase();
  const looksRural = Boolean(destination.isRural) || RURAL_REGION_KEYWORDS.some((keyword) => regionText.includes(keyword));

  return looksRural ? 'NZ_RURAL' : 'NZ_METRO';
}

function resolveWeightBand(totalWeight: number): WeightBand {
  return TEMPORARY_RATE_TABLE.find((band) => totalWeight <= band.maxWeightKg) ?? TEMPORARY_RATE_TABLE[TEMPORARY_RATE_TABLE.length - 1];
}

/**
 * Calculates the shipping charge for a shipment.
 *
 * @param input.destination Delivery destination (country is required; region/city/postcode refine the zone).
 * @param input.totalWeight Total product weight in kilograms (sum of unit weight × quantity for every cart line).
 */
export function calculateShipping(
  input: ShippingCalculationInput,
  productSubtotal?: number,
): ShippingCalculationResult {
  const totalWeight = Math.max(0, input.totalWeight);
  const zone = resolveZone(input.destination);
  const band = resolveWeightBand(totalWeight);

  const freeShippingApplied =
    TEMPORARY_FREE_SHIPPING_THRESHOLD_NZD !== null &&
    typeof productSubtotal === 'number' &&
    productSubtotal >= TEMPORARY_FREE_SHIPPING_THRESHOLD_NZD;

  const amount = freeShippingApplied ? 0 : Number(band.ratesByZone[zone].toFixed(2));

  return {
    amount,
    currency: 'NZD',
    zone,
    weightBandLabel: band.label,
    isTemporaryRate: true,
    freeShippingApplied,
  };
}
