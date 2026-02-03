import type { PlayerStats } from './types';
import { GAME_CONFIG } from './GameConfig';

export function calcStat(s: PlayerStats): number {
    const baseSum = s.base + s.flat + (s.hexFlat || 0);
    const upgradeMult = 1 + (s.mult || 0) / 100;
    const hexScaling = 1 + (s.hexMult || 0) / 100;
    return baseSum * upgradeMult * hexScaling;
}

export function getDefenseReduction(armor: number): number {
    const cappedArmor = Math.min(armor, 999999);
    return 0.95 * (cappedArmor / (cappedArmor + GAME_CONFIG.PLAYER.ARMOR_CONSTANT));
}
