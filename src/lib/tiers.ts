export interface TierInfo {
  name: string;
  color: string;
  badgeClass: string;
  minPoints: number;
}

export const TIERS: TierInfo[] = [
  { name: 'Grandmaster', color: '#ff0000', badgeClass: 'bg-red-500/10 text-red-500 border-red-500/20', minPoints: 3000 },
  { name: 'Master', color: '#ff8c00', badgeClass: 'bg-orange-500/10 text-orange-500 border-orange-500/20', minPoints: 2200 },
  { name: 'Expert', color: '#0055ff', badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20', minPoints: 1500 },
  { name: 'Specialist', color: '#03a89e', badgeClass: 'bg-teal-500/10 text-teal-500 border-teal-500/20', minPoints: 800 },
  { name: 'Pupil', color: '#00aa00', badgeClass: 'bg-green-500/10 text-green-500 border-green-500/20', minPoints: 300 },
  { name: 'Newbie', color: '#888888', badgeClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20', minPoints: 0 },
];

export function getTierForPoints(points: number): TierInfo {
  for (const tier of TIERS) {
    if (points >= tier.minPoints) {
      return tier;
    }
  }
  return TIERS[TIERS.length - 1];
}

