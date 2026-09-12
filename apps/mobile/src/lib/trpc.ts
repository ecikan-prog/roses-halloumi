import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@dairy-sales/api';

export const trpc = createTRPCReact<AppRouter>();

function getApiUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error('Set EXPO_PUBLIC_API_URL to a reachable /trpc endpoint before starting the Expo app.');
  }

  return apiUrl;
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
