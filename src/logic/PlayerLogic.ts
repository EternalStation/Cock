import type { GameState, Enemy } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import { calcStat } from './MathUtils';

export function updatePlayer(state: GameState, keys: Record<string, boolean>) {
    const { player } = state;
    // Debug Log
    // console.log('updatePlayer', state.spawnTimer, keys);

    // Spawn Animation Logic
    if (state.spawnTimer > 0) {
        state.spawnTimer -= 1 / 60;
        return;
    }

    // Movement
    let mx = 0, my = 0;
    if (keys['w']) my--;
    if (keys['s']) my++;
    if (keys['a']) mx--;
    if (keys['d']) mx++;

    if (mx || my) {
        player.lastAngle = Math.atan2(my, mx);
        player.x += Math.cos(player.lastAngle) * player.speed;
        player.y += Math.sin(player.lastAngle) * player.speed;
    }

    // Camera Follow
    state.camera.x = player.x - CANVAS_WIDTH / 2;
    state.camera.y = player.y - CANVAS_HEIGHT / 2;

    // Regen
    const maxHp = calcStat(player.hp);
    const regenAmount = calcStat(player.reg) / 60; // 60 FPS
    player.curHp = Math.min(maxHp, player.curHp + regenAmount);

    // Auto-Aim Logic
    let nearest: Enemy | null = null;
    let minDist = 800; // Increased to 800px per user request
    state.enemies.forEach((e: Enemy) => {
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < minDist) {
            minDist = d;
            nearest = e;
        }
    });

    if (nearest) {
        const target = nearest as Enemy;
        player.targetAngle = Math.atan2(target.y - player.y, target.x - player.x);
    } else {
        player.targetAngle = player.lastAngle;
    }
}
