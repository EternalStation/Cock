import type { Enemy } from '../types';

export function updateBossEnemy(e: Enemy, currentSpd: number, dx: number, dy: number, pushX: number, pushY: number) {
    let vx = 0, vy = 0;

    // Default Boss Movement (Direct Chasing, Slower/Heavier)
    // Most bosses currently strictly chase or use simple logic.
    // Pentagon Boss had specific logic in the original file:
    if (e.shape === 'pentagon') {
        const angleToPlayerP = Math.atan2(dy, dx);
        vx = Math.cos(angleToPlayerP) * currentSpd + pushX;
        vy = Math.sin(angleToPlayerP) * currentSpd + pushY;
        return { vx, vy };
    }

    // Default Fallback for other shapes (Circle, Triangle, etc acting as bosses)
    // They just chase directly for now unless specific skills are added
    const angle = Math.atan2(dy, dx);
    vx = Math.cos(angle) * currentSpd + pushX;
    vy = Math.sin(angle) * currentSpd + pushY;

    // TODO: Add specific Boss Skills (Attack Patterns) here if needed in future

    return { vx, vy };
}
