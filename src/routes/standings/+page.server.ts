import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/prisma';
import { getFriendIds } from '#lib/server/friends';
import { getTierForPoints } from '#lib/tiers';

export const load: PageServerLoad = async ({ url, locals }) => {
  const selectedModule = url.searchParams.get('module') || undefined;
  const friendsOnly = url.searchParams.get('friends') === 'true';

  let userIds: string[] | undefined = undefined;
  if (friendsOnly && locals.user) {
    const friendIds = await getFriendIds(locals.user.id);
    userIds = [locals.user.id, ...friendIds];
  }

  // Get all available modules for filtering
  const moduleList = await prisma.problem.findMany({
    select: { module: true },
    distinct: ['module'],
    orderBy: { module: 'asc' },
  });

  if (selectedModule) {
    const whereClause: any = {
      problem: { module: selectedModule },
    };
    if (userIds) {
      whereClause.userId = { in: userIds };
    }

    const grouped = await prisma.userProblemPoints.groupBy({
      by: ['userId'],
      where: whereClause,
      _sum: { points: true },
      _count: { problemId: true },
      orderBy: {
        _sum: { points: 'desc' },
      },
      take: 100,
    });

    const userDetails = await prisma.user.findMany({
      where: {
        id: { in: grouped.map((g) => g.userId) },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    const userMap = new Map(userDetails.map((u) => [u.id, u]));

    const standings = grouped.map((g, idx) => {
      const u = userMap.get(g.userId);
      const points = g._sum.points || 0;
      return {
        rank: idx + 1,
        userId: g.userId,
        name: u?.name || 'Anonymous',
        email: u?.email || '',
        image: u?.image,
        points,
        solvedCount: g._count.problemId,
        tier: getTierForPoints(points),
      };
    });

    return {
      standings,
      modules: moduleList.map((m) => m.module),
      selectedModule,
      friendsOnly,
      currentUser: locals.user,
    };
  }

  // Global Standings
  const userWhere: any = {};
  if (userIds) {
    userWhere.id = { in: userIds };
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      totalPoints: true,
      solvedCount: true,
    },
    orderBy: [
      { totalPoints: 'desc' },
      { solvedCount: 'desc' },
      { createdAt: 'asc' },
    ],
    take: 100,
  });

  const standings = users.map((u, idx) => ({
    rank: idx + 1,
    userId: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    points: u.totalPoints,
    solvedCount: u.solvedCount,
    tier: getTierForPoints(u.totalPoints),
  }));

  return {
    standings,
    modules: moduleList.map((m) => m.module),
    selectedModule: null,
    friendsOnly,
    currentUser: locals.user,
  };
};

