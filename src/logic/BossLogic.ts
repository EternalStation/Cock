import type { Enemy, GameState } from './types';
import { spawnEnemyBullet } from './ProjectileLogic.ts';

export function updateBossBehavior(enemy: Enemy, state: GameState) {
    if (!enemy.boss) return;

    // Movement is handled in updateEnemies.
    // Boss projectile attacks are REMOVED.
    // They are now pure collision damage threats with high visual intensity.
}
