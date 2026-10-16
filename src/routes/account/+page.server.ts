import type { PageServerLoad } from './$types';
import { requireAuth } from '#lib/server/rbac';
import { prisma } from '#lib/server/prisma';
import { getTierForPoints } from '#lib/tiers';

export const load: PageServerLoad = async (event) => {
  const user = requireAuth(event);

  const [dbUser, solvedProblems, friendRecords] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        totalPoints: true,
        solvedCount: true,
        createdAt: true,
      },
    }),
    prisma.userProblemPoints.findMany({
      where: { userId: user.id },
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            module: true,
            group: true,
          },
        },
      },
      orderBy: { awardedAt: 'desc' },
    }),
    prisma.friendship.findMany({
      where: {
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      include: {
        userA: {
          select: { id: true, name: true, email: true, image: true, totalPoints: true },
        },
        userB: {
          select: { id: true, name: true, email: true, image: true, totalPoints: true },
        },
      },
    }),
  ]);

  if (!dbUser) {
    throw new Error('User record not found.');
  }

  // Separate friends into accepted and incoming pending
  const acceptedFriends = friendRecords
    .filter((f) => f.status === 'ACCEPTED')
    .map((f) => {
      const other = f.userAId === user.id ? f.userB : f.userA;
      return {
        id: other.id,
        name: other.name,
        email: other.email,
        image: other.image,
        totalPoints: other.totalPoints,
        tier: getTierForPoints(other.totalPoints),
      };
    });

  const incomingRequests = friendRecords
    .filter((f) => f.status === 'PENDING' && f.initiatorId !== user.id)
    .map((f) => {
      const fromUser = f.initiatorId === f.userAId ? f.userA : f.userB;
      return {
        targetUserId: fromUser.id,
        fromUser: {
          id: fromUser.id,
          name: fromUser.name,
          email: fromUser.email,
          image: fromUser.image,
        },
      };
    });

  return {
    profile: {
      ...dbUser,
      tier: getTierForPoints(dbUser.totalPoints),
    },
    solvedProblems: solvedProblems.map((sp) => ({
      problemId: sp.problemId,
      title: sp.problem.title,
      module: sp.problem.module,
      group: sp.problem.group,
      points: sp.points,
      awardedAt: sp.awardedAt,
    })),
    acceptedFriends,
    incomingRequests,
  };
};

