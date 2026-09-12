import { createTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../../api/src/router/index';

export const trpc = createTRPCReact<AppRouter>();

export function createApiClient(getToken: () => string | null) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/trpc',
        headers() {
          const token = getToken();
          return token ? { authorization: 'Bearer ' + token } : {};
        },
      }),
    ],
  });
}
