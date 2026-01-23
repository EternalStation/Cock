import type { Enemy } from './types';

export function updateBossBehavior(enemy: Enemy) {
    if (!enemy.boss) return;

    // Movement is handled in updateEnemies.
    // Boss projectile attacks are REMOVED.
    // They are now pure collision damage threats with high visual intensity.
}
