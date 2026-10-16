import { error, type RequestEvent } from "@sveltejs/kit";

export function requireAuth(event: RequestEvent) {
  if (!event.locals.user) {
    throw error(401, "Authentication required. Please log in.");
  }
  return event.locals.user;
}

export function requireRole(event: RequestEvent, allowedRoles: string[]) {
  const user = requireAuth(event);
  if (!user.role || !allowedRoles.includes(user.role)) {
    throw error(403, "Access denied. Insufficient permissions.");
  }
  return user;
}

export function requireTeacher(event: RequestEvent) {
  return requireRole(event, ["teacher", "admin"]);
}

export function requireAdmin(event: RequestEvent) {
  return requireRole(event, ["admin"]);
}
