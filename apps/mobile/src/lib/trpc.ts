import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Platform } from 'react-native';
import superjson from 'superjson';
import type { AppRouter } from '@dairy-sales/api';

export const trpc = createTRPCReact<AppRouter>();

const WEB_PRODUCTION_API_URL = 'https://dairy-salesapi-production.up.railway.app/trpc';

function isLocalWebHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isProductionRailwayWebHost() {
  if (typeof window === 'undefined') {
    return false;
  }

  const { hostname } = window.location;
  return hostname.endsWith('.up.railway.app') && hostname.includes('production');
}

function getApiUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (apiUrl && apiUrl !== 'https://api.example.com/trpc') {
    return apiUrl;
  }

  if (Platform.OS === 'web' && !isLocalWebHost() && isProductionRailwayWebHost()) {
    return WEB_PRODUCTION_API_URL;
  }

  throw new Error('Set EXPO_PUBLIC_API_URL to a reachable /trpc endpoint before starting the Expo app.');
}

export function createApiClient(getToken: () => string | null) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: getApiUrl(),
        headers() {
          const token = getToken();
          return token ? { authorization: 'Bearer ' + token } : {};
        },
      }),
    ],
  });
}
