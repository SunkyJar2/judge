import { prisma } from './prisma';

export function getCanonicalPair(userId1: string, userId2: string) {
  if (userId1 === userId2) {
    throw new Error('You cannot friend yourself.');
  }
  return userId1 < userId2
    ? { userAId: userId1, userBId: userId2 }
    : { userAId: userId2, userBId: userId1 };
}

export async function sendFriendRequest(requesterId: string, targetId: string) {
  const { userAId, userBId } = getCanonicalPair(requesterId, targetId);
  return prisma.friendship.upsert({
    where: {
      userAId_userBId: { userAId, userBId },
    },
    update: {
      initiatorId: requesterId,
      status: 'PENDING',
    },
    create: {
      userAId,
      userBId,
      initiatorId: requesterId,
      status: 'PENDING',
    },
  });
}

export async function acceptFriendRequest(currentUserId: string, requesterId: string) {
  const { userAId, userBId } = getCanonicalPair(currentUserId, requesterId);
  const existing = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });

  if (!existing || existing.initiatorId === currentUserId) {
    throw new Error('No pending request to accept.');
  }

  return prisma.friendship.update({
    where: { userAId_userBId: { userAId, userBId } },
    data: { status: 'ACCEPTED' },
  });
}

export async function declineOrRemoveFriend(userId1: string, userId2: string) {
  const { userAId, userBId } = getCanonicalPair(userId1, userId2);
  return prisma.friendship.deleteMany({
    where: { userAId, userBId },
  });
}

export async function respondFriendRequest(
  requesterId: string,
  targetUserId: string,
  accept: boolean
) {
  const { userAId, userBId } = getCanonicalPair(requesterId, targetUserId);

  if (accept) {
    return prisma.friendship.update({
      where: { userAId_userBId: { userAId, userBId } },
      data: { status: 'ACCEPTED' },
    });
  } else {
    return prisma.friendship.delete({
      where: { userAId_userBId: { userAId, userBId } },
    });
  }
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const records = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { userAId: true, userBId: true },
  });

  return records.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

export async function getFriendshipStatus(viewerId: string, profileId: string) {
  if (viewerId === profileId) return 'self';
  const { userAId, userBId } = getCanonicalPair(viewerId, profileId);
  const row = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
  });
  if (!row) return 'none';
  if (row.status === 'ACCEPTED') return 'accepted';
  return row.initiatorId === viewerId ? 'outgoing' : 'incoming';
}

export async function getFriendOverview(userId: string) {
  const records = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: {
      userA: { select: { id: true, name: true, image: true, role: true } },
      userB: { select: { id: true, name: true, image: true, role: true } },
    },
  });

  const friends = [];
  const incoming = [];
  const outgoing = [];

  for (const row of records) {
    const friend = row.userAId === userId ? row.userB : row.userA;
    if (row.status === 'ACCEPTED') {
      friends.push(friend);
    } else if (row.initiatorId === userId) {
      outgoing.push(friend);
    } else {
      incoming.push(friend);
    }
  }

  return { friends, incoming, outgoing };
}

