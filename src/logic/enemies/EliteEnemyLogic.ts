import type { GameState, Enemy } from '../types';
import { ARENA_CENTERS, ARENA_RADIUS } from '../MapLogic';
import { spawnParticles, spawnFloatingNumber } from '../ParticleLogic';
import { playSfx } from '../AudioLogic';
import { calcStat } from '../MathUtils';
import { spawnMinion } from './UniqueEnemyLogic';


export function updateEliteCircle(e: Enemy, state: GameState, player: any, dist: number, dx: number, dy: number, currentSpd: number, pushX: number, pushY: number) {
    let vx = 0, vy = 0;
    if (!e.eliteState) e.eliteState = 0;
    if (e.eliteState === 0) {
        if (dist < 600 && (!e.timer || Date.now() > e.timer)) {
            e.eliteState = 1; e.timer = Date.now() + 500;

        }
        const a = Math.atan2(dy, dx);
        vx = Math.cos(a) * currentSpd + pushX; vy = Math.sin(a) * currentSpd + pushY;
    } else if (e.eliteState === 1) {
        vx = 0; vy = 0; e.rotationPhase = (e.rotationPhase || 0) + 0.2;
        if (Date.now() > (e.timer || 0)) {
            const ta = Math.atan2(player.y - e.y, player.x - e.x);
            e.lockedTargetX = player.x + Math.cos(ta) * 200; e.lockedTargetY = player.y + Math.sin(ta) * 200;
            e.dashState = ta; e.eliteState = 2; e.timer = Date.now() + 500;
        }
    } else if (e.eliteState === 2) {
        if (e.lockedTargetX !== undefined && e.lockedTargetY !== undefined) {
            const rDx = e.lockedTargetX - e.x, rDy = e.lockedTargetY - e.y, rDist = Math.hypot(rDx, rDy);
            if (rDist > 10) {
                const a = Math.atan2(rDy, rDx); vx = Math.cos(a) * 10; vy = Math.sin(a) * 10;
                spawnParticles(state, e.x, e.y, '#EF4444', 1);
            } else {
                e.eliteState = 0; e.timer = Date.now() + 5000;
                e.lockedTargetX = undefined; e.lockedTargetY = undefined;
            }
        }
    }
    return { vx, vy };
}

export function updateEliteTriangle(e: Enemy, state: GameState, dist: number, dx: number, dy: number, currentSpd: number, pushX: number, pushY: number) {
    let vx = 0, vy = 0;
    if (!e.eliteState) e.eliteState = 0;
    if (e.eliteState === 0) {
        if ((!e.timer || Date.now() > e.timer) && dist < 600) {
            e.eliteState = 1; e.timer = Date.now() + 3500;

        }
        const a = Math.atan2(dy, dx);
        vx = Math.cos(a) * e.spd + pushX; vy = Math.sin(a) * e.spd + pushY;
    } else {
        e.rotationPhase = (e.rotationPhase || 0) + 0.5;
        const a = Math.atan2(dy, dx) + Math.sin(Date.now() / 100) * 0.5;
        const fast = currentSpd * 2.55;
        vx = Math.cos(a) * fast + pushX; vy = Math.sin(a) * fast + pushY;
        spawnParticles(state, e.x, e.y, '#FCD34D', 1);
        if (Date.now() > (e.timer || 0)) {
            e.eliteState = 0; e.timer = Date.now() + 5000;
        }
    }
    return { vx, vy };
}

export function updateEliteSquare(e: Enemy, state: GameState, currentSpd: number, dx: number, dy: number, pushX: number, pushY: number) {
    const aS = Math.atan2(dy, dx);
    const vx = Math.cos(aS) * (currentSpd * 0.5) + pushX;
    const vy = Math.sin(aS) * (currentSpd * 0.5) + pushY;
    if (Math.random() < 0.1) spawnParticles(state, e.x + (Math.random() - 0.5) * e.size * 2, e.y + (Math.random() - 0.5) * e.size * 2, '#94A3B8', 1);
    return { vx, vy };
}

export function updateEliteDiamond(e: Enemy, state: GameState, player: any, dist: number, dx: number, dy: number, currentSpd: number, pushX: number, pushY: number, onEvent?: (event: string, data?: any) => void) {
    const angleToPlayerD = Math.atan2(dy, dx);
    let vx = 0, vy = 0;

    // ELITE SKILL: HYPER BEAM
    if (!e.eliteState) e.eliteState = 0;

    // Keep distance logic (Internal to Elite)
    const nearestCenter = ARENA_CENTERS.reduce((best, center) => {
        const distToCenter = Math.hypot(e.x - center.x, e.y - center.y);
        return distToCenter < Math.hypot(e.x - best.x, e.y - best.y) ? center : best;
    }, ARENA_CENTERS[0]);
    const distToCenter = Math.hypot(e.x - nearestCenter.x, e.y - nearestCenter.y);
    const distToWall = ARENA_RADIUS - distToCenter;
    const veryCloseToWall = distToWall < 500;

    let distGoal = 600;
    const distFactor = (dist - distGoal) / 100;

    if (e.eliteState === 0) {
        // Kiting Phase
        if (veryCloseToWall && (!e.lastDodge || Date.now() - (e.lastDodge || 0) > 3000)) {
            const angleToCenter = Math.atan2(nearestCenter.y - e.y, nearestCenter.x - e.x);
            const angleAwayFromPlayer = angleToPlayerD + Math.PI;
            e.dashState = (angleToCenter + angleAwayFromPlayer) / 2;
            e.lockedTargetX = 0; // Escape flag
            e.lockedTargetY = Date.now() + 2000;
            e.lastDodge = Date.now();
        }

        if (e.lockedTargetX === 0) {
            if (Date.now() > (e.lockedTargetY || 0)) {
                e.lockedTargetX = undefined;
                e.lockedTargetY = undefined;
            } else {
                vx = Math.cos(e.dashState || 0) * currentSpd * 2;
                vy = Math.sin(e.dashState || 0) * currentSpd * 2;
            }
        }

        if (e.lockedTargetX !== 0) {
            vx = Math.cos(angleToPlayerD) * distFactor * currentSpd + pushX;
            vy = Math.sin(angleToPlayerD) * distFactor * currentSpd + pushY;
        }

        // Charge Transition
        if (Date.now() - (e.lastAttack || 0) > 3600) {
            e.eliteState = 1;
            e.timer = Date.now() + 1000;
            e.dashState = angleToPlayerD; // Lock angle

        }
    } else if (e.eliteState === 1) {
        // Charging (Waiting)
        vx = 0; vy = 0;
        if (Date.now() > (e.timer || 0)) {
            e.eliteState = 2;
            e.timer = Date.now() + 1500;
            playSfx('laser');
        }
    } else if (e.eliteState === 2) {
        // Firing
        vx = 0; vy = 0;
        e.lockedTargetX = e.x + Math.cos(e.dashState || 0) * 2000;
        e.lockedTargetY = e.y + Math.sin(e.dashState || 0) * 2000;

        const laserAngle = e.dashState || 0;
        const px = player.x - e.x;
        const py = player.y - e.y;
        const pDist = Math.hypot(px, py);
        const pAngle = Math.atan2(py, px);
        const angleDiff = Math.abs(pAngle - laserAngle);

        if (angleDiff < 0.1 && pDist < 2000) {
            if (!e.laserTick || Date.now() - e.laserTick > 100) {
                e.laserTick = Date.now();
                const rawTickDmg = Math.floor(5 * (1 + Math.floor(state.gameTime / 300) * 0.5));
                const tickDmg = Math.max(0, rawTickDmg - calcStat(player.arm));

                // Check Shield Chunks
                let absorbed = 0;
                if (player.shieldChunks && player.shieldChunks.length > 0) {
                    let rem = tickDmg;
                    for (const chunk of player.shieldChunks) {
                        if (chunk.amount >= rem) {
                            chunk.amount -= rem;
                            absorbed += rem;
                            rem = 0; break;
                        } else {
                            absorbed += chunk.amount;
                            rem -= chunk.amount;
                            chunk.amount = 0;
                        }
                    }
                    player.shieldChunks = player.shieldChunks.filter((c: any) => c.amount > 0);
                }

                const actualDmg = tickDmg - absorbed;
                if (tickDmg > 0) {
                    if (actualDmg > 0) {
                        player.curHp -= actualDmg;
                        player.damageTaken += actualDmg;
                    }
                    spawnFloatingNumber(state, player.x, player.y, Math.round(tickDmg).toString(), '#ef4444', false);
                }

                if (player.curHp <= 0 && !state.gameOver) {
                    state.gameOver = true;
                    if (onEvent) onEvent('game_over');
                }
            }
        }

        // --- ZOMBIE INSTA-KILL BY LASER ---
        state.enemies.forEach(z => {
            if (z.isZombie && z.zombieState === 'active' && !z.dead) {
                const zdx = z.x - e.x, zdy = z.y - e.y;
                const zDist = Math.hypot(zdx, zdy);
                const zAngle = Math.atan2(zdy, zdx);
                const zAngleDiff = Math.abs(zAngle - laserAngle);
                if (zAngleDiff < 0.1 && zDist < 2000) {
                    z.dead = true; z.hp = 0;
                    spawnParticles(state, z.x, z.y, '#4ade80', 15);
                    playSfx('smoke-puff');
                }
            }
        });

        if (Date.now() > (e.timer || 0)) {
            e.eliteState = 0;
            e.lastAttack = Date.now();
            e.lockedTargetX = undefined;
            e.lockedTargetY = undefined;
        }
    }
    return { vx, vy };
}

export function updateElitePentagon(e: Enemy, state: GameState, dist: number, dx: number, dy: number, currentSpd: number, pushX: number, pushY: number, _onEvent?: (event: string, data?: any) => void) {
    // Movement handled by Normal/Shared logic (caller should handle calling Normal Pentagon Update if this returns null or if it's integrated)
    // Actually, Elite Pentagon logic IS the same as Normal but with Elite Spawning parameters.
    // The spawning is the ONLY difference in logic besides stats (which are handled in spawnEnemy).
    // So we can just reuse the Normal Pentagon logic for movement.
    // BUT we must handle Spawning here if we want strict separation, OR allow Normal logic to handle it if we pass "isElite".

    // As per previous plan, Spawning is handled in the `NormalEnemyLogic`'s `updateNormalPentagon` (if needed) or separate trigger.
    // Let's implement Spawning HERE for Elite, and remove it from `NormalEnemyLogic` if called as elite?
    // Or simpler: Pentagon Logic is identical except for Spawn params.
    // The Caller (EnemyLogic.ts) can just handle the movement via `updateNormalPentagon`, then call `handlePentagonSpawning(e, true)`?

    // For now, let's assume Elite Pentagon logic just handles the Extra Spawning capability (Stunning Minions).
    // The movement is identical.
    // I will return NULL here to indicate "Use Default Movement", or I can duplicate the movement.
    // I will duplicate the movement for robustness as requested, or import it.
    // Since I cannot easily import from NormalEnemyLogic (circular?), I will duplicate the small block.
    // Actually, I'll refer to updateNormalPentagon in my instruction to the orchestrator.
    // But `updateNormalPentagon` is not imported here.

    // Let's duplicate the kiting logic for Elite Pentagon to ensure it's self-contained in `EliteEnemies.ts`.

    // Capture original palette
    if (!e.originalPalette) e.originalPalette = e.palette;

    const nearestCenter = ARENA_CENTERS.reduce((best, center) => {
        const distToCenter = Math.hypot(e.x - center.x, e.y - center.y);
        return distToCenter < Math.hypot(e.x - best.x, e.y - best.y) ? center : best;
    }, ARENA_CENTERS[0]);
    const distToWall = ARENA_RADIUS - Math.hypot(e.x - nearestCenter.x, e.y - nearestCenter.y);

    // Initialize random kiting distance
    if (!e.distGoal) {
        e.distGoal = 700 + Math.random() * 150; // Random 700-850
    }

    const angleToPlayerP = Math.atan2(dy, dx);
    let moveAngle = angleToPlayerP;
    let speedMult = 1.0;

    if (distToWall < 400) {
        moveAngle = Math.atan2(nearestCenter.y - e.y, nearestCenter.x - e.x);
        speedMult = 1.5;
    } else if (dist < e.distGoal - 50) {
        moveAngle = angleToPlayerP + Math.PI;
        speedMult = 1.5;
    } else if (dist > e.distGoal + 50) {
        moveAngle = angleToPlayerP + (Math.sin(state.gameTime) * 0.2);
    } else {
        const strafeDir = (e.id % 2 === 0) ? 1 : -1;
        moveAngle = angleToPlayerP + (Math.PI / 2) * strafeDir;
        speedMult = 0.8;
    }

    let vx = Math.cos(moveAngle) * currentSpd * speedMult + pushX;
    let vy = Math.sin(moveAngle) * currentSpd * speedMult + pushY;

    // --- DESTRUCTION MODE (Age > 60s) ---
    const age = state.gameTime - (e.spawnedAt || 0);

    // Check for Living Minions (Used for both modes)
    const myMinions = state.enemies.filter(m => m.parentId === e.id && !m.dead && m.shape === 'minion');
    const orbitingMinions = myMinions.filter(m => m.minionState === 0);

    if (age > 60) {
        // --- DESTRUCTION SEQUENCE ---
        if (orbitingMinions.length > 0) {
            // PHASE 1: RELEASE PAIN (One by one every 3s)
            if (!e.lastAttack) e.lastAttack = Date.now();
            if (Date.now() - e.lastAttack > 3000) {
                const victim = orbitingMinions[0];
                victim.minionState = 1; // Launch
                playSfx('stun-disrupt'); // Release sound
                e.lastAttack = Date.now();
            }
        } else {
            // PHASE 2: IMMINENT EXPLOSION (5s Countdown)
            const dTimer = (e as any).destructTimer;
            if (!dTimer) {
                (e as any).destructTimer = Date.now() + 5000;
                playSfx('warning');
            }



            if (Date.now() > dTimer) {
                // No AoE damage as per request - just suicide and particles
                e.dead = true;
                e.hp = 0;
                spawnParticles(state, e.x, e.y, '#EF4444', 30);
                playSfx('rare-kill');
            }
        }
    } else {
        // --- NORMAL SPAWNING & GUARDIAN LOGIC ---
        if (!e.summonState) e.summonState = 0; // 0: Idle, 1: Charging (Green Blink)
        const hasMinions = myMinions.length > 0;

        // Calculate Explicit Distance to Player for Guardian Trigger
        const distToPlayer = Math.hypot(state.player.x - e.x, state.player.y - e.y);

        // Guardian Mode: Player close + Has Minions -> Turn RED and Trigger Minions
        if (distToPlayer <= 550 && hasMinions) {


            // Shake Effect (Vibration)
            vx += (Math.random() - 0.5) * 4;
            vy += (Math.random() - 0.5) * 4;
        } else {
            // Normal State / Charging State Handling
            if (e.summonState === 1) {


                if (Date.now() > (e.timer || 0)) {
                    // FINISH CHARGING -> SPAWN (Now matching normal: 3 minions)
                    spawnMinion(state, e, true, 3);

                    e.lastAttack = Date.now();
                    e.summonState = 0;
                    if (e.originalPalette) e.palette = e.originalPalette;
                }
            } else {
                // IDLE STATE
                if (!e.originalPalette) e.originalPalette = e.palette;
                e.palette = e.originalPalette;

                // Check Spawn Timer (Limit to 9 Minions, same as normal: 15s interval)
                const spawnInterval = 15000;
                if (!e.lastAttack) e.lastAttack = Date.now();
                if (Date.now() - e.lastAttack > spawnInterval && myMinions.length < 9) {
                    e.summonState = 1;
                    e.timer = Date.now() + 3000;
                    playSfx('warning');
                }
            }
        }
    }

    return { vx, vy };
}
