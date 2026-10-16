import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { recordTelemetry } from '#lib/server/telemetry/buffer';

export const handle: Handle = async ({ event, resolve }) => {
  const start = performance.now();

  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  try {
    return await svelteKitHandler({
      event,
      resolve: async (evt) => {
        const response = await resolve(evt);
        response.headers.set('X-Content-Type-Options', 'nosniff');
        if (evt.url.pathname.includes('/statement.pdf')) {
          response.headers.set('X-Frame-Options', 'SAMEORIGIN');
        } else {
          response.headers.set('X-Frame-Options', 'DENY');
        }
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        recordTelemetry({
          method: evt.request.method,
          path: evt.route.id ?? evt.url.pathname,
          statusCode: response.status,
          elapsedMs: Math.round(performance.now() - start),
          ipAddress: evt.getClientAddress ? evt.getClientAddress() : '127.0.0.1',
          userId: evt.locals.user?.id ?? null,
        });

        return response;
      },
      auth,
      building,
    });
  } catch (err) {
    console.error('[HOOKS ERROR]:', err);
    throw err;
  }
};
