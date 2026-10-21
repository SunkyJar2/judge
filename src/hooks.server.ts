import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { recordTelemetry } from '#lib/server/telemetry/buffer';

export const handle: Handle = async ({ event, resolve }) => {
  const start = performance.now();

  try {
    const session = await auth.api.getSession({
      headers: event.request.headers,
    }).catch(() => null);

    event.locals.user = session?.user ?? null;
    event.locals.session = session?.session ?? null;
  } catch (authErr) {
    console.error('[AUTH SESSION ERROR]:', authErr);
    event.locals.user = null;
    event.locals.session = null;
  }

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

        let clientIp = '127.0.0.1';
        try {
          clientIp = evt.getClientAddress();
        } catch {
          clientIp = evt.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
        }

        recordTelemetry({
          method: evt.request.method,
          path: evt.route.id ?? evt.url.pathname,
          statusCode: response.status,
          elapsedMs: Math.round(performance.now() - start),
          ipAddress: clientIp,
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

export const handleError: HandleServerError = ({ error, event }) => {
  const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Internal Server Error');
  console.error(`[SERVER ERROR] ${event.request.method} ${event.url.pathname}:`, error);
  return {
    message,
  };
};
