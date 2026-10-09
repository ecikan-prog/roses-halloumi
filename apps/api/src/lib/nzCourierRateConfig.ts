/**
 * NZ domestic courier rate configuration.
 *
 * Grassland Cheese only sells and ships within New Zealand. This file is the
 * SINGLE PLACE that should ever need to change when we sign up with a real
 * courier or the courier updates its price list — the calculation engine
 * (`shipping.ts`) and the checkout code never need to be touched again once
 * this file reflects the real rate card.
 *
 * ARCHITECTURE: this is intentionally structured to match how NZ Post's
 * domestic Courier product (and its Domestic Rating API) actually prices a
 * shipment, so that swapping `STATIC_RATE_CARD` for a real call to that API
 * later is a drop-in change rather than a rewrite:
 *
 *   - Rates depend on a DISTANCE/POSTAGE CATEGORY derived from the origin and
 *     destination postcodes (across-town / within-island / nationwide —
 *     NZ Post's API returns/derives an equivalent "postage type"), not a
 *     single flat NZ-wide price.
 *   - Pricing is banded in 5kg increments off a CHARGEABLE WEIGHT (the
 *     greater of actual weight and volumetric/cubic weight) — NZ Post's
 *     rating API takes weight AND dimensions for exactly this reason.
 *   - Rural delivery adds a flat surcharge, exactly like NZ Post's rural
 *     surcharge.
 *
 * IMPORTANT: the `NATIONWIDE` first-5kg base rate and the rural surcharge
 * below are entered from NZ Post's currently published domestic Courier
 * pricing (as provided when this file was last updated). The `ACROSS_TOWN`
 * and `WITHIN_ISLAND` rates are NOT confirmed published figures — they are
 * clearly-labelled placeholders (set lower than the nationwide rate, which
 * is directionally correct for any NZ courier) until we either obtain NZ
 * Post's published across-town/within-island Courier price or connect the
 * real NZ Post Domestic Rating API (source postcode, destination postcode,
 * weight, dimensions, rural status, postage type in -> priced quote out),
 * which is the intended long-term replacement for this whole file.
 */

/**
 * Our dispatch/depot address — the ORIGIN of every shipment. The customer's
 * delivery address is always the DESTINATION; it is never used as the
 * origin. Update this if the depot ever moves.
 */
export const DEPOT_ADDRESS = {
  name: 'Grassland Cheese Depot',
  addressLine: '251 Glenbrook Road',
  rd: 'RD4',
  suburb: 'Karaka',
  city: 'Pukekohe',
  region: 'Auckland',
  postcode: '2113',
  country: 'New Zealand',
} as const;

/** Packaging weight added once per shipment before splitting into parcels (kg). PLACEHOLDER — update to the real box/packaging weight used. */
export const PACKAGING_WEIGHT_KG = 0.15;

/** Maximum weight (kg) a single parcel can carry before the shipment must be split into multiple parcels. PLACEHOLDER — update to the chosen courier's actual per-parcel weight limit. */
export const MAX_PARCEL_WEIGHT_KG = 25;

/**
 * Volumetric (cubic/dimensional) weight divisor used to convert parcel
 * dimensions (cm) into an equivalent weight in kg via
 * `(lengthCm * widthCm * heightCm) / VOLUMETRIC_DIVISOR`. `6000` is a
 * commonly published NZ domestic courier volumetric divisor. Chargeable
 * weight is always `max(actualWeightKg, volumetricWeightKg)` — this only
 * matters once real parcel dimensions are supplied (see
 * `ShippingCalculationInput.parcelDimensionsCm` in `shipping.ts`); until
 * then shipments are rated on actual weight only.
 */
export const VOLUMETRIC_DIVISOR = 6000;

/**
 * The distance/postage categories our rate card and the NZ Post Domestic
 * Rating API both key pricing on:
 *   - `ACROSS_TOWN`: origin and destination are in the same local
 *     courier delivery area (approximated here by matching postcode prefix).
 *   - `WITHIN_ISLAND`: same island as the depot, but not across town.
 *   - `NATIONWIDE`: different island from the depot (requires the
 *     inter-island line-haul/ferry leg) — this is the category an
 *     Auckland (North Island) depot shipping to any South Island address
 *     must always use, never the `WITHIN_ISLAND` rate.
 */
export type NzDistanceCategory = 'ACROSS_TOWN' | 'WITHIN_ISLAND' | 'NATIONWIDE';

export type NzWeightIncrementRate = {
  /** Size (kg) of the first pricing increment, e.g. 5 for "first 5kg". */
  firstIncrementKg: number;
  /** Price (NZD) for the first increment. */
  firstIncrementRateNzd: number;
  /** Size (kg) of every subsequent pricing increment, e.g. 5 for "additional 5kg". */
  additionalIncrementKg: number;
  /** Price (NZD) added per additional (partial or full) increment above the first. */
  additionalIncrementRateNzd: number;
};

/**
 * Per-distance-category rate card, banded in weight increments (matching NZ
 * Post's own "first Nkg, then additional Nkg increments" Courier pricing
 * structure). Replace these numbers — or, longer-term, replace
 * `resolveStaticRate` in `shipping.ts` with a real NZ Post Domestic Rating
 * API call — without touching any other file.
 */
export const STATIC_RATE_CARD: Record<NzDistanceCategory, NzWeightIncrementRate> = {
  // PLACEHOLDER — not yet a confirmed published across-town Courier price.
  ACROSS_TOWN: { firstIncrementKg: 5, firstIncrementRateNzd: 12.5, additionalIncrementKg: 5, additionalIncrementRateNzd: 12.5 },
  // PLACEHOLDER — not yet a confirmed published within-island Courier price.
  WITHIN_ISLAND: { firstIncrementKg: 5, firstIncrementRateNzd: 24.9, additionalIncrementKg: 5, additionalIncrementRateNzd: 24.9 },
  // NZ Post's currently published nationwide/inter-island domestic Courier base price: $39.70 for the first 5kg, additional 5kg increments at the same base price.
  NATIONWIDE: { firstIncrementKg: 5, firstIncrementRateNzd: 39.7, additionalIncrementKg: 5, additionalIncrementRateNzd: 39.7 },
};

/** NZ Post's currently published rural delivery surcharge (NZD), applied per parcel. */
export const RURAL_SURCHARGE_NZD = 6.0;

/** PLACEHOLDER flat surcharge (NZD) added per parcel for remote/offshore delivery addresses (e.g. Stewart Island, Chatham Islands, Great Barrier Island). Not yet a confirmed published figure. */
export const REMOTE_SURCHARGE_NZD = 15;

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
 * Resolves the NZ island for a postcode, using NZ Post's published
 * first-digit postcode ranges: 0-6 is always North Island (Northland down
 * to Wellington), 8-9 is always South Island (Canterbury, West Coast,
 * Otago, Southland, Stewart Island). Postcodes starting with 7 straddle
 * both islands (e.g. 6xxx/7xxx Wellington vs 7xxx Nelson/Marlborough) —
 * PLACEHOLDER: we treat 7xxx as North Island (the majority of that range,
 * Wellington) until a precise postcode-to-region table or the real NZ Post
 * Domestic Rating API (which resolves this itself from the source and
 * destination postcodes) is connected.
 *
 * IMPORTANT: this replaces an earlier, materially incorrect rule that only
 * treated postcodes starting with "9" as South Island — that rule
 * misclassified every Canterbury/Christchurch (8xxx) and Nelson/Marlborough
 * (7xxx) address as North Island, which meant an Auckland -> South Island
 * shipment could be priced with the wrong (cheaper, within-island) rate.
 */
export function resolveIslandFromPostcode(postcode: string | null | undefined): 'NORTH' | 'SOUTH' {
  const trimmed = (postcode ?? '').trim();
  const firstDigit = Number(trimmed.charAt(0));

  if (!Number.isFinite(firstDigit) || trimmed.length === 0) {
    return 'NORTH';
  }

  return firstDigit >= 8 ? 'SOUTH' : 'NORTH';
}

/**
 * How many leading postcode digits are compared to decide "across town"
 * (same local courier delivery area as the depot). NZ postcodes are 4
 * digits; matching the first 2 digits groups nearby suburbs under the same
 * regional code. PLACEHOLDER — replace with the courier's real delivery-area
 * lookup (or the postage-type field returned by a real rating API) once
 * available.
 */
export const ACROSS_TOWN_POSTCODE_PREFIX_LENGTH = 2;

/**
 * Resolves the distance/postage category for a shipment from the depot
 * (`originPostcode`) to a customer address (`destinationPostcode`).
 * Always returns `NATIONWIDE` when the origin and destination are on
 * different islands, regardless of postcode prefix — an Auckland depot
 * shipping to a South Island address must never be priced as
 * `WITHIN_ISLAND`.
 */
export function resolveDistanceCategory(originPostcode: string | null | undefined, destinationPostcode: string | null | undefined): NzDistanceCategory {
  const originIsland = resolveIslandFromPostcode(originPostcode);
  const destinationIsland = resolveIslandFromPostcode(destinationPostcode);

  if (originIsland !== destinationIsland) {
    return 'NATIONWIDE';
  }

  const originPrefix = (originPostcode ?? '').trim().slice(0, ACROSS_TOWN_POSTCODE_PREFIX_LENGTH);
  const destinationPrefix = (destinationPostcode ?? '').trim().slice(0, ACROSS_TOWN_POSTCODE_PREFIX_LENGTH);

  if (originPrefix.length > 0 && originPrefix === destinationPrefix) {
    return 'ACROSS_TOWN';
  }

  return 'WITHIN_ISLAND';
}
