import type { PlayerStats } from './types';

export function calcStat(s: PlayerStats): number {
    return (s.base + s.flat) * (1 + (s.mult || 0) / 100);
}

export function getDefenseReduction(armor: number): number {
    const cappedArmor = Math.min(armor, 99999);
    return 0.95 * (cappedArmor / (cappedArmor + 5263));
}
