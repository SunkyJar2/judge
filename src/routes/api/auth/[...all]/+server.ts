import { auth } from '#lib/server/auth';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import type { RequestHandler } from '@sveltejs/kit';

const handler = toSvelteKitHandler(auth);

export const GET: RequestHandler = async (event) => handler(event);
export const POST: RequestHandler = async (event) => handler(event);
export const PUT: RequestHandler = async (event) => handler(event);
export const DELETE: RequestHandler = async (event) => handler(event);
export const PATCH: RequestHandler = async (event) => handler(event);
