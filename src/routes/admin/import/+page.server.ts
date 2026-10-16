import type { PageServerLoad } from './$types';
import { requireTeacher } from '#lib/server/rbac';

export const load: PageServerLoad = async (event) => {
  const user = requireTeacher(event);
  return {
    user,
  };
};

