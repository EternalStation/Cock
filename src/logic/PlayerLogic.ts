import type { GameState, Enemy } from './types';
import { isInMap, ARENA_CENTERS, PORTALS, getHexWallLine, ARENA_RADIUS } from './MapLogic';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
import { calcStat } from './MathUtils';
import { playSfx } from './AudioLogic';

export function updatePlayer(state: GameState, keys: Record<string, boolean>, onEvent?: (type: string, data?: any) => void) {
    const { player } = state;

    // Track player position history for laser prediction (last 60 frames = ~1 second at 60fps)
    if (!state.playerPosHistory) state.playerPosHistory = [];
    state.playerPosHistory.unshift({ x: player.x, y: player.y, timestamp: Date.now() });
    if (state.playerPosHistory.length > 60) state.playerPosHistory.pop();

    // Spawn Animation Logic
    if (state.spawnTimer > 0) {
        state.spawnTimer -= 1 / 60;
        return;
    }

    // Movement
    let vx = 0, vy = 0;

    const isStunned = player.stunnedUntil && Date.now() < player.stunnedUntil;

    if (!isStunned) {
        if (keys['w'] || keys['arrowup']) vy--;
        if (keys['s'] || keys['arrowdown']) vy++;
        if (keys['a'] || keys['arrowleft']) vx--;
        if (keys['d'] || keys['arrowright']) vx++;
    }

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
            // Check if point is inside map OR inside an active portal
            const valid = isInMap(tx, ty) || isInActivePortal(tx, ty, state);
            if (!valid) return false;

            // Check hitbox points
            for (let i = 0; i < 6; i++) {
                const ang = (Math.PI / 3) * i;
                const hx = tx + Math.cos(ang) * hitboxR;
                const hy = ty + Math.sin(ang) * hitboxR;
                if (!isInMap(hx, hy) && !isInActivePortal(hx, hy, state)) return false;
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
            const rawWallDmg = maxHp * 0.10;
            const armor = calcStat(player.arm);
            const wallDmg = Math.max(0, rawWallDmg - armor);
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

    // Auto-Aim Logic (skip barrels - they're neutral)
    let nearest: Enemy | null = null;
    let minDist = 800;
    state.enemies.forEach((e: Enemy) => {
        if (e.dead || e.isNeutral) return; // Skip dead enemies and neutral barrels
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
            // Check collision cooldown (prevent damage every frame)
            const now = Date.now();
            // Apply Contact Damage to Player
            // Default: 15% of enemy max HP, or custom if set. Neutral objects (barrels) deal 0 dmg.
            const rawDmg = e.isNeutral ? 0 : (e.customCollisionDmg !== undefined ? e.customCollisionDmg : e.maxHp * 0.15);
            const armor = calcStat(player.arm);
            const finalDmg = Math.max(1, rawDmg - armor);

            if (finalDmg > 0) {
                player.curHp -= finalDmg;
                player.damageTaken += finalDmg;
            }

            // Stun Logic
            if (e.stunOnHit) {
                const currentStunEnd = Math.max(Date.now(), player.stunnedUntil || 0);
                player.stunnedUntil = currentStunEnd + 1000; // Stack 1 second
                playSfx('stun-disrupt'); // "Engine Disabled" sound
            } else {
                playSfx('hit');
            }

            if (onEvent) onEvent('player_hit', { dmg: finalDmg });

            // Set collision cooldown for this specific enemy
            e.lastCollisionDamage = now;


            // Contact Death for ALL Enemies (only if not on cooldown)
            if (!e.lastCollisionDamage || now - e.lastCollisionDamage <= 10) {
                e.dead = true;
                e.hp = 0;
                state.killCount++;
                state.score += 1;

                // XP Reward - 12x for elites
                let xpGain = player.xp_per_kill.base;
                if (e.xpRewardMult !== undefined) {
                    xpGain *= e.xpRewardMult;
                } else if (e.isElite) {
                    xpGain *= 12; // Elite = 12x XP
                }
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

// Helper to check if point is inside an active portal trigger zone (ignoring wall collision)
function isInActivePortal(x: number, y: number, state: GameState): boolean {
    if (state.portalState !== 'open') return false;

    // Find active portals in current arena
    const activePortals = PORTALS.filter(p => p.from === state.currentArena);
    const center = ARENA_CENTERS.find(c => c.id === state.currentArena) || ARENA_CENTERS[0];

    // Check distance to any portal line segment
    for (const p of activePortals) {
        const wall = getHexWallLine(center.x, center.y, ARENA_RADIUS, p.wall);

        // Distance from point to line segment
        const A = x - wall.x1;
        const B = y - wall.y1;
        const C = wall.x2 - wall.x1;
        const D = wall.y2 - wall.y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = wall.x1;
            yy = wall.y1;
        }
        else if (param > 1) {
            xx = wall.x2;
            yy = wall.y2;
        }
        else {
            xx = wall.x1 + param * C;
            yy = wall.y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 80) return true;
    }

    return false;
}
