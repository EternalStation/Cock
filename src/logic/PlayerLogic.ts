import type { GameState, Enemy } from './types';
import { isInMap, ARENA_CENTERS } from './MapLogic';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import { calcStat } from './MathUtils';
import { playSfx } from './AudioLogic';

export function updatePlayer(state: GameState, keys: Record<string, boolean>, onEvent?: (type: string, data?: any) => void) {
    const { player } = state;

    // Spawn Animation Logic
    if (state.spawnTimer > 0) {
        state.spawnTimer -= 1 / 60;
        return;
    }

    // Movement
    let vx = 0, vy = 0;
    if (keys['w'] || keys['arrowup']) vy--;
    if (keys['s'] || keys['arrowdown']) vy++;
    if (keys['a'] || keys['arrowleft']) vx--;
    if (keys['d'] || keys['arrowright']) vx++;

    if (vx !== 0 || vy !== 0) {
        // Normalize
        const mag = Math.hypot(vx, vy);
        const dx = (vx / mag) * player.speed;
        const dy = (vy / mag) * player.speed;

        player.lastAngle = Math.atan2(dy, dx);
        const nextX = player.x + dx;
        const nextY = player.y + dy;

        // Hitbox radius
        const hitboxR = 56;

        const checkMove = (tx: number, ty: number) => {
            if (!isInMap(tx, ty)) return false;
            for (let i = 0; i < 6; i++) {
                const ang = (Math.PI / 3) * i;
                if (!isInMap(tx + Math.cos(ang) * hitboxR, ty + Math.sin(ang) * hitboxR)) return false;
            }
            return true;
        };

        if (checkMove(nextX, nextY)) {
            player.x = nextX;
            player.y = nextY;
        } else {
            // Mirror Reflection Logic
            let bestC = ARENA_CENTERS[0];
            let dMin = Infinity;
            ARENA_CENTERS.forEach((c) => {
                const d = Math.hypot(player.x - c.x, player.y - c.y);
                if (d < dMin) {
                    dMin = d;
                    bestC = c;
                }
            });

            const lx = player.x - bestC.x;
            const ly = player.y - bestC.y;
            let normAngle = Math.atan2(ly, lx);
            if (normAngle < 0) normAngle += Math.PI * 2;

            const sector = Math.floor(normAngle / (Math.PI / 3));
            const collisionNormalAngle = (sector * 60 + 30) * Math.PI / 180;
            const nx = Math.cos(collisionNormalAngle);
            const ny = Math.sin(collisionNormalAngle);

            const dot = dx * nx + dy * ny;
            const rx = dx - 2 * dot * nx;
            const ry = dy - 2 * dot * ny;
            const reflectDir = Math.atan2(ry, rx);

            player.knockback.x = Math.cos(reflectDir) * 37.5;
            player.knockback.y = Math.sin(reflectDir) * 37.5;

            const maxHp = calcStat(player.hp);
            const wallDmg = maxHp * 0.10;
            player.curHp -= wallDmg;
            player.damageTaken += wallDmg;
            playSfx('wall-shock');

            if (onEvent) onEvent('player_hit', { dmg: wallDmg });

            if (player.curHp <= 0) {
                state.gameOver = true;
                if (onEvent) onEvent('game_over');
            }
        }
    }

    // Apply & Decay Knockback Momentum
    if (Math.abs(player.knockback.x) > 0.1 || Math.abs(player.knockback.y) > 0.1) {
        const nx = player.x + player.knockback.x;
        const ny = player.y + player.knockback.y;
        if (isInMap(nx, ny)) {
            player.x = nx;
            player.y = ny;
        }
        player.knockback.x *= 0.85;
        player.knockback.y *= 0.85;
    } else {
        player.knockback.x = 0;
        player.knockback.y = 0;
    }

    // Camera Follow
    state.camera.x = player.x - CANVAS_WIDTH / 2;
    state.camera.y = player.y - CANVAS_HEIGHT / 2;

    // Regen
    const maxHp = calcStat(player.hp);
    const regenAmount = calcStat(player.reg) / 60;
    player.curHp = Math.min(maxHp, player.curHp + regenAmount);

    // Auto-Aim Logic
    let nearest: Enemy | null = null;
    let minDist = 800;
    state.enemies.forEach((e: Enemy) => {
        if (e.dead) return;
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < minDist) {
            minDist = d;
            nearest = e;
        }
    });

    if (nearest !== null) {
        const actualNearest: Enemy = nearest;
        player.targetAngle = Math.atan2(actualNearest.y - player.y, actualNearest.x - player.x);
    } else {
        player.targetAngle = player.lastAngle;
    }

    // --- ENEMY CONTACT DAMAGE & COLLISION ---
    state.enemies.forEach(e => {
        if (e.dead || e.hp <= 0) return;

        const dToE = Math.hypot(e.x - player.x, e.y - player.y);
        const contactDist = e.size + 15;

        if (dToE < contactDist) {
            // Apply Contact Damage to Player
            const rawDmg = 5;
            const armor = calcStat(player.arm);
            const finalDmg = Math.max(1, rawDmg - armor);

            player.curHp -= finalDmg;
            player.damageTaken += finalDmg;
            playSfx('hit');

            if (onEvent) onEvent('player_hit', { dmg: finalDmg });

            // Contact Death for Standard Enemies
            if (!e.boss && !e.isRare) {
                e.dead = true;
                e.hp = 0;
                state.killCount++;
                state.score += 1;

                // XP Reward
                const xpGain = player.xp_per_kill.base;
                player.xp.current += xpGain;
                while (player.xp.current >= player.xp.needed) {
                    player.xp.current -= player.xp.needed;
                    player.level++;
                    player.xp.needed *= 1.10;
                    if (onEvent) onEvent('level_up');
                }
            }

            // Check Game Over
            if (player.curHp <= 0) {
                state.gameOver = true;
                if (onEvent) onEvent('game_over');
            }
        }
    });
}
