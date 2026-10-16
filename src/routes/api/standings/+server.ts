import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '#lib/server/prisma';
import { getFriendIds } from '#lib/server/friends';
import { getTierForPoints } from '#lib/tiers';

export const GET: RequestHandler = async (event) => {
  const { url, locals } = event;
  const moduleFilter = url.searchParams.get('module');
  const friendsOnly = url.searchParams.get('friendsOnly') === 'true';

  let userIds: string[] | undefined = undefined;

  if (friendsOnly) {
    if (!locals.user) {
      return json({ success: false, error: 'Authentication required for friends standings.' }, { status: 401 });
    }
    const friendIds = await getFriendIds(locals.user.id);
    userIds = [locals.user.id, ...friendIds];
  }

  if (moduleFilter) {
    // Module-specific points aggregation
    const whereClause: any = {
      problem: { module: moduleFilter }
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
        _sum: { points: 'desc' }
      },
      take: 100
    });

    const userDetails = await prisma.user.findMany({
      where: {
        id: { in: grouped.map((g) => g.userId) }
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      }
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

    return json({ success: true, module: moduleFilter, standings });
  }

  // Global Standings - Fast query reading from materialized columns
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
      { createdAt: 'asc' }
    ],
    take: 100
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

  return json({ success: true, standings });
};

