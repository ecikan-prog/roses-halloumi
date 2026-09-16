/**
 * NZ domestic shipping calculation engine.
 *
 * Grassland Cheese currently sells and ships within New Zealand only. This
 * module contains the CALCULATION LOGIC only — every rate, surcharge, band
 * and classification list lives in `nzCourierRateConfig.ts`. When the real
 * courier rate card is supplied, only that config file needs to change; this
 * engine and the checkout/order code do not need to be rewritten.
 *
 * Every shipment is calculated from our depot (the ORIGIN, see
 * `DEPOT_ADDRESS` in `nzCourierRateConfig.ts`) to the customer's delivery
 * address (the DESTINATION). The origin is never the customer's address —
 * callers must always pass `DEPOT_ADDRESS` as `origin`.
 *
 * IMPORTANT: the rates produced here are placeholders (see
 * `nzCourierRateConfig.ts`) until a real courier rate card is configured —
 * `isTemporaryRate` is always `true` while that remains the case and must be
 * surfaced to the customer (checkout UI, confirmation email) rather than
 * presented as a final/official price.
 */

import {
  DEPOT_ADDRESS,
  FREE_SHIPPING_THRESHOLD_NZD,
  MAX_PARCEL_WEIGHT_KG,
  NZ_WEIGHT_BANDS,
  PACKAGING_WEIGHT_KG,
  REMOTE_POSTCODES,
  REMOTE_SURCHARGE_NZD,
  RURAL_ADDRESS_KEYWORDS,
  RURAL_SURCHARGE_NZD,
  SOUTH_ISLAND_SURCHARGE_NZD,
  resolveIslandFromPostcode,
  type NzWeightBand,
} from './nzCourierRateConfig.js';

export type ShippingDestination = {
  /** Must be New Zealand — Grassland Cheese does not currently ship internationally. */
  country: string;
  region?: string | null;
  city?: string | null;
  postcode?: string | null;
  /** Explicit override if the caller already knows the address is rural (e.g. from a future real rural-address lookup). */
  isRural?: boolean;
};

/** The shipment's starting point. In production this is always `DEPOT_ADDRESS` — never the customer's address. */
export type ShippingOrigin = {
  country: string;
  region?: string | null;
  city?: string | null;
  postcode?: string | null;
};

export type ShippingCalculationInput = {
  /** Our dispatch/depot address. Always `DEPOT_ADDRESS` in production — the customer's address is never the origin. */
  origin: ShippingOrigin;
  destination: ShippingDestination;
  /** Total product weight in kilograms (sum of productWeightKg * qty across the cart). Packaging weight is added internally. */
  totalWeight: number;
};

export type NzIsland = 'NORTH' | 'SOUTH';
export type NzServiceArea = 'URBAN' | 'RURAL';

export type ShippingCalculationResult = {
  amount: number;
  currency: 'NZD';
  /** Human-readable destination classification, e.g. "North Island – Urban" or "South Island – Rural (remote surcharge applied)". */
  zoneLabel: string;
  island: NzIsland;
  serviceArea: NzServiceArea;
  isRemote: boolean;
  /** True when the origin (depot) and destination are on different islands, i.e. the shipment requires an inter-island ferry/line-haul leg. */
  crossesIslands: boolean;
  weightBandLabel: string;
  /** Total shipment weight used for rating, i.e. total product weight + packaging weight. */
  totalShipmentWeightKg: number;
  packagingWeightKg: number;
  /** Number of parcels the shipment was split into (> 1 when the shipment exceeds the configured max parcel weight). */
  parcelCount: number;
  /**
   * True while placeholder rates from `nzCourierRateConfig.ts` are in use.
   * Callers (checkout UI, emails) must surface this so nobody mistakes the
   * placeholder for a final rate.
   */
  isTemporaryRate: boolean;
  freeShippingApplied: boolean;
};

function normalizeCountry(country: string) {
  return country.trim().toLowerCase();
}

/** Returns true if the given country string refers to New Zealand (the only destination we currently ship to). */
export function isNewZealandDestination(country: string) {
  const normalized = normalizeCountry(country);
  return normalized === 'nz' || normalized === 'new zealand' || normalized === 'aotearoa' || normalized === 'aotearoa new zealand';
}

function resolveServiceArea(destination: ShippingDestination): NzServiceArea {
  if (destination.isRural) {
    return 'RURAL';
  }

  const addressText = `${destination.region ?? ''} ${destination.city ?? ''}`.toLowerCase();
  const looksRural = RURAL_ADDRESS_KEYWORDS.some((keyword) => addressText.includes(keyword.toLowerCase()));

  return looksRural ? 'RURAL' : 'URBAN';
}

function resolveIsRemote(destination: ShippingDestination): boolean {
  const postcode = (destination.postcode ?? '').trim();
  return postcode.length > 0 && REMOTE_POSTCODES.includes(postcode);
}

function resolveWeightBand(weightKg: number): NzWeightBand {
  return NZ_WEIGHT_BANDS.find((band) => weightKg <= band.maxWeightKg) ?? NZ_WEIGHT_BANDS[NZ_WEIGHT_BANDS.length - 1];
}

/** Splits a total shipment weight into evenly-sized parcels, none exceeding the configured max parcel weight. */
function splitIntoParcels(totalShipmentWeightKg: number): number[] {
  if (totalShipmentWeightKg <= 0) {
    return [0];
  }

  const parcelCount = Math.max(1, Math.ceil(totalShipmentWeightKg / MAX_PARCEL_WEIGHT_KG));
  const perParcelWeight = totalShipmentWeightKg / parcelCount;
  return Array.from({ length: parcelCount }, () => perParcelWeight);
}

function ratePerParcel(weightKg: number, crossesIslands: boolean, serviceArea: NzServiceArea, isRemote: boolean): number {
  const band = resolveWeightBand(weightKg);
  let rate = band.urbanRateNzd;

  if (serviceArea === 'RURAL') {
    rate += RURAL_SURCHARGE_NZD;
  }

  if (isRemote) {
    rate += REMOTE_SURCHARGE_NZD;
  }

  if (crossesIslands) {
    rate += SOUTH_ISLAND_SURCHARGE_NZD;
  }

  return rate;
}

/**
 * Calculates the NZ domestic shipping charge for a shipment FROM our depot
 * (`origin`, always `DEPOT_ADDRESS`) TO the customer's delivery address
 * (`destination`).
 *
 * @param input.origin Dispatch origin — must always be `DEPOT_ADDRESS`, never the customer's address.
 * @param input.destination Delivery destination — must be within New Zealand.
 * @param input.totalWeight Total product weight in kilograms (sum of unit weight × quantity for every cart line, excluding packaging).
 * @param productSubtotal Optional product subtotal, used only to evaluate the (currently disabled) free-shipping threshold.
 */
export function calculateShipping(
  input: ShippingCalculationInput,
  productSubtotal?: number,
): ShippingCalculationResult {
  if (!isNewZealandDestination(input.destination.country)) {
    throw new Error('calculateShipping only supports New Zealand destinations. Validate the destination country before calling this function.');
  }

  if (!isNewZealandDestination(input.origin.country)) {
    throw new Error('calculateShipping origin must be our New Zealand depot address.');
  }

  const totalProductWeight = Math.max(0, input.totalWeight);
  const totalShipmentWeightKg = Number((totalProductWeight + PACKAGING_WEIGHT_KG).toFixed(3));

  const originIsland = resolveIslandFromPostcode(input.origin.postcode);
  const destinationIsland = resolveIslandFromPostcode(input.destination.postcode);
  const crossesIslands = originIsland !== destinationIsland;
  const serviceArea = resolveServiceArea(input.destination);
  const isRemote = resolveIsRemote(input.destination);

  const freeShippingApplied =
    FREE_SHIPPING_THRESHOLD_NZD !== null && typeof productSubtotal === 'number' && productSubtotal >= FREE_SHIPPING_THRESHOLD_NZD;

  const parcelWeights = splitIntoParcels(totalShipmentWeightKg);
  const amount = freeShippingApplied
    ? 0
    : Number(parcelWeights.reduce((sum, parcelWeight) => sum + ratePerParcel(parcelWeight, crossesIslands, serviceArea, isRemote), 0).toFixed(2));

  const weightBand = resolveWeightBand(parcelWeights[0]);
  const islandLabel = destinationIsland === 'SOUTH' ? 'South Island' : 'North Island';
  const areaLabel = serviceArea === 'RURAL' ? 'Rural' : 'Urban';
  const zoneLabel = `${islandLabel} – ${areaLabel}${isRemote ? ' (remote surcharge applied)' : ''}${crossesIslands ? ' (inter-island)' : ''}`;

  return {
    amount,
    currency: 'NZD',
    zoneLabel,
    island: destinationIsland,
    serviceArea,
    isRemote,
    crossesIslands,
    weightBandLabel: parcelWeights.length > 1 ? `${weightBand.label} × ${parcelWeights.length} parcels` : weightBand.label,
    totalShipmentWeightKg,
    packagingWeightKg: PACKAGING_WEIGHT_KG,
    parcelCount: parcelWeights.length,
    isTemporaryRate: true,
    freeShippingApplied,
  };
}

export { DEPOT_ADDRESS };

