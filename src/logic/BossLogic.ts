import type { Enemy, GameState } from './types';
import { spawnEnemyBullet } from './ProjectileLogic.ts';

export function updateBossBehavior(enemy: Enemy, state: GameState) {
    if (!enemy.boss) return;

    // Attack Logic
    if (Date.now() - enemy.lastAttack > 2500) {
        if (enemy.bossType === 0) {
            // Spread Projectiles
            const a = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
            for (let i = -2; i <= 2; i++) {
                spawnEnemyBullet(state, enemy.x, enemy.y, a, 15, i * 0.2); // dmg 15 hardcoded in original
            }
        } else {
            // Tracking Snipe
            const a = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
            spawnEnemyBullet(state, enemy.x, enemy.y, a, 25, 0); // dmg 25 hardcoded
        }
        // Need to trigger SFX here ideally, but we'll return a flag or event?
        // Or we pass a callback for SFX.
        enemy.lastAttack = Date.now();
    }
}
