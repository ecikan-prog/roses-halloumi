/**
 * NZ domestic courier rate configuration.
 *
 * Grassland Cheese only sells and ships within New Zealand. This file is the
 * SINGLE PLACE that should ever need to change when we sign up with a real
 * courier or the courier updates its price list — the calculation engine
 * (`shipping.ts`) and the checkout code never need to be touched again once
 * this file reflects the real rate card.
 *
 * IMPORTANT: every rate/surcharge value below is a clearly-labelled
 * PLACEHOLDER, not a real courier's published price. It exists purely so the
 * checkout has a structured, weight- and destination-based system to
 * calculate from instead of a flat fee. Replace the numbers (and the
 * urban/rural/remote classification lists) with the actual NZ courier's
 * current rate card before relying on this for real pricing.
 */

/** Packaging weight added once per shipment before splitting into parcels (kg). PLACEHOLDER — update to the real box/packaging weight used. */
export const PACKAGING_WEIGHT_KG = 0.15;

/** Maximum weight (kg) a single parcel can carry before the shipment must be split into multiple parcels. PLACEHOLDER — update to the chosen courier's actual per-parcel weight limit. */
export const MAX_PARCEL_WEIGHT_KG = 25;

export type NzWeightBand = {
  label: string;
  /** Upper bound (kg) for this band, inclusive. Use Infinity for the last band. */
  maxWeightKg: number;
  /** PLACEHOLDER base urban NZ domestic rate (NZD) for a single parcel in this band. */
  urbanRateNzd: number;
};

/**
 * PLACEHOLDER NZ domestic weight bands + base urban rates (NZD, per parcel).
 * Update the labels/maxWeightKg/urbanRateNzd values to match the real
 * courier's published rate card. Add or remove bands as needed — the
 * calculation engine reads this array directly.
 */
export const NZ_WEIGHT_BANDS: NzWeightBand[] = [
  { label: 'Up to 1kg', maxWeightKg: 1, urbanRateNzd: 6.5 },
  { label: '1kg – 3kg', maxWeightKg: 3, urbanRateNzd: 8.5 },
  { label: '3kg – 5kg', maxWeightKg: 5, urbanRateNzd: 11.5 },
  { label: '5kg – 10kg', maxWeightKg: 10, urbanRateNzd: 15.5 },
  { label: `10kg – ${MAX_PARCEL_WEIGHT_KG}kg (max per parcel)`, maxWeightKg: MAX_PARCEL_WEIGHT_KG, urbanRateNzd: 21.5 },
];

/** PLACEHOLDER flat surcharge (NZD) added per parcel for rural delivery addresses. */
export const RURAL_SURCHARGE_NZD = 4.5;

/** PLACEHOLDER flat surcharge (NZD) added per parcel for remote/offshore delivery addresses (e.g. Stewart Island, Chatham Islands, Great Barrier Island). */
export const REMOTE_SURCHARGE_NZD = 15;

/** PLACEHOLDER surcharge (NZD) added per parcel for South Island deliveries, in case the chosen courier prices the islands differently. Set to 0 if the courier charges the same NZ-wide rate. */
export const SOUTH_ISLAND_SURCHARGE_NZD = 0;

/** PLACEHOLDER free-shipping threshold (NZD product subtotal). Set to null to disable free shipping entirely. */
export const FREE_SHIPPING_THRESHOLD_NZD: number | null = null;

/**
 * Heuristic rural-address keywords, used only until we have the courier's
 * real rural-delivery postcode/address list. Any of these appearing in the
 * suburb/region text will be treated as a rural (non-urban) address.
 * PLACEHOLDER — replace with the courier's actual rural delivery lookup.
 */
export const RURAL_ADDRESS_KEYWORDS = ['rural', 'rd', 'r.d.', 'remote', 'farm', 'station'];

/**
 * PLACEHOLDER list of NZ postcodes treated as remote/offshore for surcharge
 * purposes (e.g. Stewart Island, Chatham Islands, Great Barrier Island,
 * Waiheke Island). Replace with the courier's real remote-area postcode
 * list.
 */
export const REMOTE_POSTCODES = [
  '9818', // Stewart Island / Oban (placeholder example)
  '8942', // Chatham Islands (placeholder example)
  '0980', // Great Barrier Island (placeholder example)
];

/**
 * Resolves the NZ island for a postcode.
 *
 * PLACEHOLDER rule: NZ postcodes beginning with "9" are South Island
 * (matches the commonly-used convention that South Island postcodes start
 * at 9xxx), everything else is treated as North Island. This is a
 * simplification and does not perfectly capture every offshore/edge-case
 * postcode — replace with a precise postcode-to-region table if the courier
 * requires exact island routing.
 */
export function resolveIslandFromPostcode(postcode: string | null | undefined): 'NORTH' | 'SOUTH' {
  const trimmed = (postcode ?? '').trim();
  return trimmed.startsWith('9') ? 'SOUTH' : 'NORTH';
}
