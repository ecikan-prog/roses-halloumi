/**
 * NZ domestic shipping calculation engine.
 *
 * Grassland Cheese currently sells and ships within New Zealand only. This
 * module contains the CALCULATION LOGIC only — every rate, surcharge, band
 * and classification list lives in `nzCourierRateConfig.ts`. When the real
 * courier rate card (or the real NZ Post Domestic Rating API) is connected,
 * only `resolveStaticRate`/`nzCourierRateConfig.ts` need to change; this
 * engine and the checkout/order code do not need to be rewritten.
 *
 * Every shipment is calculated from our depot (the ORIGIN, see
 * `DEPOT_ADDRESS` in `nzCourierRateConfig.ts`) to the customer's delivery
 * address (the DESTINATION). The origin is never the customer's address —
 * callers must always pass `DEPOT_ADDRESS` as `origin`.
 *
 * PRICING MODEL: matches how a real NZ domestic courier (and the NZ Post
 * Domestic Rating API) actually rates a shipment:
 *   1. Resolve a DISTANCE CATEGORY (across-town / within-island /
 *      nationwide) from the origin and destination postcodes — an Auckland
 *      depot shipping to any South Island address is always `NATIONWIDE`,
 *      never a South Island "within island" rate.
 *   2. Resolve CHARGEABLE WEIGHT per parcel — the greater of actual weight
 *      and volumetric/cubic weight (from parcel dimensions, when known).
 *   3. Price each parcel from the category's weight-increment rate card
 *      (first Nkg, then additional Nkg increments), then add rural/remote
 *      surcharges per parcel.
 *
 * IMPORTANT: `isTemporaryRate` is always `true` while `nzCourierRateConfig`
 * still contains any unconfirmed placeholder figures (see that file) —
 * callers (checkout UI, emails) must surface this so nobody mistakes these
 * numbers for an official, final courier price.
 */

import {
  DEPOT_ADDRESS,
  FREE_SHIPPING_THRESHOLD_NZD,
  MAX_PARCEL_WEIGHT_KG,
  PACKAGING_WEIGHT_KG,
  REMOTE_POSTCODES,
  REMOTE_SURCHARGE_NZD,
  RURAL_ADDRESS_KEYWORDS,
  RURAL_SURCHARGE_NZD,
  STATIC_RATE_CARD,
  VOLUMETRIC_DIVISOR,
  resolveDistanceCategory,
  resolveIslandFromPostcode,
  type NzDistanceCategory,
  type NzWeightIncrementRate,
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

/** A single parcel's physical dimensions (cm), used to compute volumetric/cubic weight. */
export type ParcelDimensionsCm = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ShippingCalculationInput = {
  /** Our dispatch/depot address. Always `DEPOT_ADDRESS` in production — the customer's address is never the origin. */
  origin: ShippingOrigin;
  destination: ShippingDestination;
  /** Total product weight in kilograms (sum of productWeightKg * qty across the cart). Packaging weight is added internally. */
  totalWeight: number;
  /**
   * Optional per-parcel dimensions (cm), applied to every parcel the
   * shipment is split into, used to compute chargeable (volumetric) weight.
   * Product dimensions aren't tracked yet, so callers may omit this — the
   * shipment is then rated on actual weight only.
   */
  parcelDimensionsCm?: ParcelDimensionsCm;
  /** Number of parcels to force the shipment into, if already known (e.g. multiple distinct boxes). Otherwise parcels are derived automatically from `MAX_PARCEL_WEIGHT_KG`. */
  numberOfParcels?: number;
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
  /** Distance/postage category the rate card actually priced this shipment under. */
  distanceCategory: NzDistanceCategory;
  weightBandLabel: string;
  /** Total shipment weight used for rating, i.e. total product weight + packaging weight (actual, not chargeable/volumetric). */
  totalShipmentWeightKg: number;
  /** Chargeable weight per parcel actually used to price the shipment (max of actual and volumetric weight). */
  chargeableWeightKg: number;
  packagingWeightKg: number;
  /** Number of parcels the shipment was split into (> 1 when the shipment exceeds the configured max parcel weight). */
  parcelCount: number;
  /**
   * True while any placeholder rates from `nzCourierRateConfig.ts` are in
   * use (currently the ACROSS_TOWN/WITHIN_ISLAND rates, and the rural/remote
   * postcode heuristics). Callers (checkout UI, emails) must surface this so
   * nobody mistakes the placeholder for a final rate.
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

/** Splits a total shipment weight into evenly-sized parcels, none exceeding the configured max parcel weight. */
function splitIntoParcels(totalShipmentWeightKg: number, numberOfParcels?: number): number[] {
  if (totalShipmentWeightKg <= 0) {
    return [0];
  }

  const parcelCount = Math.max(1, numberOfParcels ?? Math.ceil(totalShipmentWeightKg / MAX_PARCEL_WEIGHT_KG));
  const perParcelWeight = totalShipmentWeightKg / parcelCount;
  return Array.from({ length: parcelCount }, () => perParcelWeight);
}

/** Volumetric (cubic) weight in kg for a parcel's dimensions (cm), per `VOLUMETRIC_DIVISOR`. */
function volumetricWeightKg(dimensionsCm: ParcelDimensionsCm): number {
  return (dimensionsCm.lengthCm * dimensionsCm.widthCm * dimensionsCm.heightCm) / VOLUMETRIC_DIVISOR;
}

/** Chargeable weight for a parcel: the greater of its actual weight and its volumetric weight (if dimensions are known). */
function resolveChargeableWeightKg(actualWeightKg: number, dimensionsCm?: ParcelDimensionsCm): number {
  if (!dimensionsCm) {
    return actualWeightKg;
  }

  return Math.max(actualWeightKg, volumetricWeightKg(dimensionsCm));
}

/** Prices a single parcel's chargeable weight against a distance category's weight-increment rate card. */
function priceForChargeableWeight(rate: NzWeightIncrementRate, chargeableWeightKg: number): number {
  if (chargeableWeightKg <= 0) {
    return 0;
  }

  if (chargeableWeightKg <= rate.firstIncrementKg) {
    return rate.firstIncrementRateNzd;
  }

  const additionalKg = chargeableWeightKg - rate.firstIncrementKg;
  const additionalIncrements = Math.ceil(additionalKg / rate.additionalIncrementKg);
  return rate.firstIncrementRateNzd + additionalIncrements * rate.additionalIncrementRateNzd;
}

/**
 * Resolves the priced rate for one parcel. This is the single seam to
 * replace with a real courier rating call (e.g. the NZ Post Domestic Rating
 * API, passing origin/destination postcode, chargeable weight, dimensions,
 * rural status and distance category) — every other function in this file
 * is independent of where the rate actually comes from.
 */
function resolveStaticRate(distanceCategory: NzDistanceCategory, chargeableWeightKg: number, serviceArea: NzServiceArea, isRemote: boolean): number {
  const rate = STATIC_RATE_CARD[distanceCategory];
  let price = priceForChargeableWeight(rate, chargeableWeightKg);

  if (serviceArea === 'RURAL') {
    price += RURAL_SURCHARGE_NZD;
  }

  if (isRemote) {
    price += REMOTE_SURCHARGE_NZD;
  }

  return price;
}

function distanceCategoryLabel(category: NzDistanceCategory): string {
  if (category === 'ACROSS_TOWN') {
    return 'Across town';
  }

  if (category === 'NATIONWIDE') {
    return 'Nationwide (inter-island)';
  }

  return 'Within island';
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
export function calculateShipping(input: ShippingCalculationInput, productSubtotal?: number): ShippingCalculationResult {
  if (!isNewZealandDestination(input.destination.country)) {
    throw new Error('calculateShipping only supports New Zealand destinations. Validate the destination country before calling this function.');
  }

  if (!isNewZealandDestination(input.origin.country)) {
    throw new Error('calculateShipping origin must be our New Zealand depot address.');
  }

  const totalProductWeight = Math.max(0, input.totalWeight);
  const totalShipmentWeightKg = Number((totalProductWeight + PACKAGING_WEIGHT_KG).toFixed(3));

  const destinationIsland = resolveIslandFromPostcode(input.destination.postcode);
  const crossesIslands = resolveIslandFromPostcode(input.origin.postcode) !== destinationIsland;
  const distanceCategory = resolveDistanceCategory(input.origin.postcode, input.destination.postcode);
  const serviceArea = resolveServiceArea(input.destination);
  const isRemote = resolveIsRemote(input.destination);

  const freeShippingApplied =
    FREE_SHIPPING_THRESHOLD_NZD !== null && typeof productSubtotal === 'number' && productSubtotal >= FREE_SHIPPING_THRESHOLD_NZD;

  const parcelWeights = splitIntoParcels(totalShipmentWeightKg, input.numberOfParcels);
  const chargeableParcelWeights = parcelWeights.map((weightKg) => resolveChargeableWeightKg(weightKg, input.parcelDimensionsCm));

  const amount = freeShippingApplied
    ? 0
    : Number(
        chargeableParcelWeights
          .reduce((sum, chargeableWeightKg) => sum + resolveStaticRate(distanceCategory, chargeableWeightKg, serviceArea, isRemote), 0)
          .toFixed(2),
      );

  const islandLabel = destinationIsland === 'SOUTH' ? 'South Island' : 'North Island';
  const areaLabel = serviceArea === 'RURAL' ? 'Rural' : 'Urban';
  const zoneLabel = `${islandLabel} – ${areaLabel} · ${distanceCategoryLabel(distanceCategory)}${isRemote ? ' (remote surcharge applied)' : ''}`;

  return {
    amount,
    currency: 'NZD',
    zoneLabel,
    island: destinationIsland,
    serviceArea,
    isRemote,
    crossesIslands,
    distanceCategory,
    weightBandLabel:
      chargeableParcelWeights.length > 1
        ? `${chargeableParcelWeights[0].toFixed(2)}kg × ${chargeableParcelWeights.length} parcels (chargeable weight)`
        : `${chargeableParcelWeights[0]?.toFixed(2) ?? '0.00'}kg (chargeable weight)`,
    totalShipmentWeightKg,
    chargeableWeightKg: chargeableParcelWeights.reduce((sum, weightKg) => sum + weightKg, 0),
    packagingWeightKg: PACKAGING_WEIGHT_KG,
    parcelCount: parcelWeights.length,
    isTemporaryRate: true,
    freeShippingApplied,
  };
}

export { DEPOT_ADDRESS };
