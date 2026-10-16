import { json, error, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '#lib/server/rbac';
import { prisma } from '#lib/server/prisma';
import { sendFriendRequest, respondFriendRequest } from '#lib/server/friends';

export const POST: RequestHandler = async (event) => {
  const currentUser = requireAuth(event);
  const body = await event.request.json().catch(() => null);

  const identifier = body?.identifier || body?.email || body?.username;
  if (!identifier) {
    throw error(400, 'User email or identifier is required.');
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { id: identifier },
        { name: identifier }
      ]
    },
    select: { id: true, name: true, email: true },
  });

  if (!targetUser) {
    throw error(404, `User "${identifier}" not found.`);
  }

  if (targetUser.id === currentUser.id) {
    throw error(400, 'You cannot send a friend request to yourself.');
  }

  const result = await sendFriendRequest(currentUser.id, targetUser.id);
  return json({ success: true, friendship: result });
};

export const PUT: RequestHandler = async (event) => {
  const currentUser = requireAuth(event);
  const body = await event.request.json().catch(() => null);

  const targetUserId = body?.targetUserId;
  const action = body?.action; // 'accept' or 'decline'

  if (!targetUserId || !action) {
    throw error(400, 'targetUserId and action are required.');
  }

  const result = await respondFriendRequest(targetUserId, currentUser.id, action === 'accept');
  return json({ success: true, result });
};

