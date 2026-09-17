/**
 * Shipping provider seam.
 *
 * The checkout and `orders.create` must never calculate a shipping amount
 * themselves — they only ever call `getShippingProvider().getQuote(...)` and
 * display/charge whatever the provider returns. This is what lets us swap
 * the temporary static rate table for a real courier rating call without
 * touching the checkout or order-creation code again.
 *
 * - `StaticShippingProvider` wraps the existing placeholder rate table in
 *   `shipping.ts`/`nzCourierRateConfig.ts`. It is a TEMPORARY development/
 *   test fallback only — every quote it returns has `isTemporaryRate: true`
 *   so callers can clearly mark it as an estimate, never a final price.
 * - `NZPostShippingProvider` is the intended production implementation: it
 *   calls the official NZ Post Domestic Rating API (source postcode,
 *   destination postcode, weight, dimensions, rural status) instead of
 *   recreating NZ Post's pricing algorithm ourselves. It only activates once
 *   real API credentials are configured (see `env.NZ_POST_*` in
 *   `config.ts`) — until then `getShippingProvider()` returns the static
 *   provider so the app keeps working with a clearly-labelled estimate.
 *
 * `getShippingProvider()` is the single place that decides which
 * implementation is active; nothing else should import `NZPostShippingProvider`
 * or `StaticShippingProvider` directly.
 */
import { env } from '../config.js';
import { calculateShipping, type ShippingCalculationInput, type ShippingCalculationResult } from './shipping.js';

export interface ShippingProvider {
  /**
   * Returns a priced shipping quote for the given shipment. `productSubtotal`
   * is optional and only used to evaluate a free-shipping threshold.
   */
  getQuote(input: ShippingCalculationInput, productSubtotal?: number): Promise<ShippingCalculationResult>;
}

/** Temporary development/test fallback. Never treat its result as an official/final courier price. */
export class StaticShippingProvider implements ShippingProvider {
  async getQuote(input: ShippingCalculationInput, productSubtotal?: number): Promise<ShippingCalculationResult> {
    // calculateShipping is synchronous; wrapped in a resolved promise so
    // every ShippingProvider implementation shares the same async interface
    // (the real NZ Post API call is necessarily asynchronous).
    return calculateShipping(input, productSubtotal);
  }
}

type NzPostAccessToken = {
  accessToken: string;
  expiresAtMs: number;
};

/**
 * Production shipping provider: prices shipments using the official NZ Post
 * Domestic Rating API rather than a hand-maintained rate table. Requires
 * `NZ_POST_CLIENT_ID` / `NZ_POST_CLIENT_SECRET` / `NZ_POST_SUBSCRIPTION_KEY`
 * / `NZ_POST_ACCOUNT_NUMBER` / `NZ_POST_SITE_CODE` to be configured (see
 * `config.ts`); `getShippingProvider()` only ever constructs this class once
 * all of those are present.
 *
 * If the live API call fails for any reason (network error, expired
 * credentials, unexpected response shape), this provider falls back to the
 * static rate table for THAT quote only, and marks the result as a
 * temporary/estimated rate — a courier API hiccup must never break
 * checkout, but it must also never silently present an invented figure as
 * an official price.
 */
export class NZPostShippingProvider implements ShippingProvider {
  private cachedToken: NzPostAccessToken | null = null;

  constructor(
    private readonly config: {
      baseUrl: string;
      clientId: string;
      clientSecret: string;
      subscriptionKey: string;
      accountNumber: string;
      siteCode: string;
      serviceCode: string;
    },
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAtMs > Date.now() + 5000) {
      return this.cachedToken.accessToken;
    }

    const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'api://parcel-labels-and-tracking/carrier.access',
      }),
    });

    if (!response.ok) {
      throw new Error(`NZ Post OAuth token request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      accessToken: body.access_token,
      expiresAtMs: Date.now() + body.expires_in * 1000,
    };

    return this.cachedToken.accessToken;
  }

  private async requestQuote(input: ShippingCalculationInput): Promise<{ amount: number; parcelCount: number }> {
    const accessToken = await this.getAccessToken();

    const parcels = Array.from({ length: Math.max(1, input.numberOfParcels ?? 1) }, () => ({
      length_mm: input.parcelDimensionsCm ? input.parcelDimensionsCm.lengthCm * 10 : undefined,
      width_mm: input.parcelDimensionsCm ? input.parcelDimensionsCm.widthCm * 10 : undefined,
      height_mm: input.parcelDimensionsCm ? input.parcelDimensionsCm.heightCm * 10 : undefined,
      weight_kg: input.totalWeight / Math.max(1, input.numberOfParcels ?? 1),
    }));

    const response = await fetch(`${this.config.baseUrl}/rating/v1/domestic/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken,
        'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
      },
      body: JSON.stringify({
        account_number: this.config.accountNumber,
        site_code: this.config.siteCode,
        service_code: this.config.serviceCode,
        origin_postcode: input.origin.postcode,
        destination_postcode: input.destination.postcode,
        destination_is_rural: Boolean(input.destination.isRural),
        parcels,
      }),
    });

    if (!response.ok) {
      throw new Error(`NZ Post Domestic Rating API request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as { total_price_incl_gst: number; parcel_count?: number };
    return { amount: Number(body.total_price_incl_gst.toFixed(2)), parcelCount: body.parcel_count ?? parcels.length };
  }

  async getQuote(input: ShippingCalculationInput, productSubtotal?: number): Promise<ShippingCalculationResult> {
    // Static result is always computed first: it gives us the zone/weight
    // metadata (island, service area, chargeable weight, etc.) that the
    // rating API response doesn't need to duplicate, and it is the fallback
    // if the live API call below fails.
    const staticResult = calculateShipping(input, productSubtotal);

    if (staticResult.freeShippingApplied) {
      return staticResult;
    }

    try {
      const quote = await this.requestQuote(input);
      return {
        ...staticResult,
        amount: quote.amount,
        parcelCount: quote.parcelCount,
        isTemporaryRate: false,
      };
    } catch (error) {
      console.error('[NZPostShippingProvider] Falling back to the static rate table for this quote because the live API call failed:', error);
      return staticResult;
    }
  }
}

let cachedProvider: ShippingProvider | null = null;

/**
 * Resolves the active `ShippingProvider`. Returns a real `NZPostShippingProvider`
 * once every required `NZ_POST_*` credential is configured; otherwise returns
 * the temporary `StaticShippingProvider` fallback. This is the ONLY place in
 * the codebase that should choose between the two implementations.
 */
export function getShippingProvider(): ShippingProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const { NZ_POST_API_BASE_URL, NZ_POST_CLIENT_ID, NZ_POST_CLIENT_SECRET, NZ_POST_SUBSCRIPTION_KEY, NZ_POST_ACCOUNT_NUMBER, NZ_POST_SITE_CODE, NZ_POST_SERVICE_CODE } =
    env;

  const isFullyConfigured =
    NZ_POST_API_BASE_URL && NZ_POST_CLIENT_ID && NZ_POST_CLIENT_SECRET && NZ_POST_SUBSCRIPTION_KEY && NZ_POST_ACCOUNT_NUMBER && NZ_POST_SITE_CODE && NZ_POST_SERVICE_CODE;

  cachedProvider = isFullyConfigured
    ? new NZPostShippingProvider({
        baseUrl: NZ_POST_API_BASE_URL,
        clientId: NZ_POST_CLIENT_ID,
        clientSecret: NZ_POST_CLIENT_SECRET,
        subscriptionKey: NZ_POST_SUBSCRIPTION_KEY,
        accountNumber: NZ_POST_ACCOUNT_NUMBER,
        siteCode: NZ_POST_SITE_CODE,
        serviceCode: NZ_POST_SERVICE_CODE,
      })
    : new StaticShippingProvider();

  return cachedProvider;
}
