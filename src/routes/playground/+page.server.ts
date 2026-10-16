import type { PageServerLoad } from './$types';
import { SUPPORTED_LANGUAGES } from '#lib/server/judge/client';

export const load: PageServerLoad = async ({ locals }) => {
  return {
    languages: SUPPORTED_LANGUAGES,
    currentUser: locals.user,
  };
};

