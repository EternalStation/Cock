import type { GameState, Enemy } from '../types';
import { ARENA_CENTERS, ARENA_RADIUS } from '../MapLogic';
import { spawnParticles } from '../ParticleLogic';
import { spawnEnemyBullet } from '../ProjectileLogic';
import { SHAPE_DEFS } from '../constants';

export function updateNormalCircle(e: Enemy, player: any, dx: number, dy: number, currentSpd: number, pushX: number, pushY: number) {
    if (e.timer && Date.now() < e.timer) return { vx: 0, vy: 0 };

    // Spiral logic if applicable (rarely used for normal circles but present in code)
    if (e.spiralRadius && e.spiralRadius > 10) {
        const angleToPlayer = Math.atan2(dy, dx);
        e.spiralAngle = (e.spiralAngle || 0) + 0.0225;
        e.spiralRadius -= 1.125;
        e.rotationPhase = angleToPlayer;
        const tx = player.x + Math.cos(e.spiralAngle) * e.spiralRadius;
        const ty = player.y + Math.sin(e.spiralAngle) * e.spiralRadius;
        const vx = tx - e.x;
        const vy = ty - e.y;
        if (e.spiralRadius < 20) e.spiralRadius = 0;
        return { vx, vy };
    }

    const a = Math.atan2(dy, dx);
    const vx = Math.cos(a) * currentSpd + pushX;
    const vy = Math.sin(a) * currentSpd + pushY;
    return { vx, vy };
}

export function updateNormalTriangle(e: Enemy, dx: number, dy: number, pushX: number, pushY: number) {
    if (!e.timer) e.timer = Date.now();
    if (Date.now() - e.lastAttack > 5000) { e.spd = 18; e.lastAttack = Date.now(); }
    const bSpd = 1.7 * SHAPE_DEFS['triangle'].speedMult;
    if (e.spd > bSpd) e.spd *= 0.90; else e.spd = bSpd;
    const a = Math.atan2(dy, dx);
    const vx = Math.cos(a) * e.spd + pushX;
    const vy = Math.sin(a) * e.spd + pushY;
    return { vx, vy };
}

export function updateNormalSquare(currentSpd: number, dx: number, dy: number, pushX: number, pushY: number) {
    const aS = Math.atan2(dy, dx);
    const vx = Math.cos(aS) * currentSpd + pushX;
    const vy = Math.sin(aS) * currentSpd + pushY;
    return { vx, vy };
}

export function updateNormalDiamond(e: Enemy, state: GameState, dist: number, dx: number, dy: number, currentSpd: number, pushX: number, pushY: number) {
    if (!e.distGoal) {
        e.distGoal = 500 + Math.random() * 400; // Variable per individual (500-900)
    }

    const angleToPlayerD = Math.atan2(dy, dx);
    const distGoal = e.distGoal;

    const nearestCenter = ARENA_CENTERS.reduce((best, center) => {
        const distToCenter = Math.hypot(e.x - center.x, e.y - center.y);
        return distToCenter < Math.hypot(e.x - best.x, e.y - best.y) ? center : best;
    }, ARENA_CENTERS[0]);
    const distToWall = ARENA_RADIUS - Math.hypot(e.x - nearestCenter.x, e.y - nearestCenter.y);

    if (!e.timer || Date.now() > e.timer) {
        e.dodgeDir = Math.random() > 0.5 ? 1 : -1;
        e.timer = Date.now() + 3000 + Math.random() * 2000; // Randomized Dodge (3-5s)
    }

    const strafeAngle = angleToPlayerD + (e.dodgeDir || 1) * Math.PI / 2;
    const distFactor = (dist - distGoal) / 100;

    let vx, vy;

    if (distToWall < 500 || (e.dodgeCooldown && Date.now() < e.dodgeCooldown)) {
        if (!e.dodgeCooldown || Date.now() > e.dodgeCooldown) {
            const angleToCenter = Math.atan2(nearestCenter.y - e.y, nearestCenter.x - e.x);
            e.dashState = (angleToCenter + angleToPlayerD + Math.PI) / 2;
            e.dodgeCooldown = Date.now() + 2000;
        }
        vx = Math.cos(e.dashState || 0) * currentSpd * 2;
        vy = Math.sin(e.dashState || 0) * currentSpd * 2;
    } else {
        vx = Math.cos(strafeAngle) * currentSpd + Math.cos(angleToPlayerD) * distFactor * currentSpd + pushX;
        vy = Math.sin(strafeAngle) * currentSpd + Math.sin(angleToPlayerD) * distFactor * currentSpd + pushY;
    }

    // Standard shot (every 6s)
    if (Date.now() - (e.lastAttack || 0) > 6000) {
        const dmg = Math.floor(20 * (1 + Math.floor(state.gameTime / 300) * 0.5));
        const bulletColor = e.baseColor || (e.originalPalette ? e.originalPalette[0] : e.palette[0]);
        spawnEnemyBullet(state, e.x, e.y, angleToPlayerD, dmg, bulletColor);
        e.lastAttack = Date.now();
    }

    return { vx, vy };
}

import { spawnMinion } from './UniqueEnemyLogic';
import { playSfx } from '../AudioLogic';

export function updateNormalPentagon(e: Enemy, state: GameState, dist: number, dx: number, dy: number, currentSpd: number, pushX: number, pushY: number) {
    // Capture original palette for state restoration
    // Safety: Don't capture if currently in a special state (Red/Green/White) to avoid locking in a status color
    const isTainted = e.palette[0] === '#EF4444' || e.palette[0] === '#4ade80' || e.palette[0] === '#FFFFFF' || e.palette[0] === '#B91C1C';
    if (!e.originalPalette && !isTainted) e.originalPalette = e.palette;

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

    // Normal Kiting logic (uses generic dist/target)
    if (distToWall < 400) {
        moveAngle = Math.atan2(nearestCenter.y - e.y, nearestCenter.x - e.x);
        speedMult = 1.5;
    } else if (dist < e.distGoal - 50) {
        moveAngle = angleToPlayerP + Math.PI; // Directly away
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

            // Blink Red/White
            const blink = Math.floor(Date.now() / 200) % 2 === 0;
            e.palette = blink ? ['#EF4444', '#B91C1C', '#991B1B'] : ['#FFFFFF', '#F0F0F0', '#E2E8F0'];

            if (Date.now() > dTimer) {
                // PHASE 3: KABOOM
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
            // Red Warning Color - Angry Pulsing "Beehive"
            const pulse = Math.floor(Date.now() / 100) % 2 === 0;
            e.palette = pulse ? ['#EF4444', '#B91C1C', '#991B1B'] : ['#B91C1C', '#991B1B', '#7F1D1D'];

            // Shake Effect (Vibration)
            vx += (Math.random() - 0.5) * 4;
            vy += (Math.random() - 0.5) * 4;
        } else {
            // Normal State / Charging State Handling

            if (e.summonState === 1) {
                // CHARGING (3 Seconds) - Blink Green
                if (Math.floor(Date.now() / 200) % 2 === 0) {
                    e.palette = ['#4ade80', '#22c55e', '#166534']; // Green
                } else {
                    e.palette = ['#FFFFFF', '#F0F0F0', '#E2E8F0']; // White Flash
                }

                if (Date.now() > (e.timer || 0)) {
                    // FINISH CHARGING -> SPAWN
                    spawnMinion(state, e, false, 3);

                    e.lastAttack = Date.now();
                    e.summonState = 0;
                    if (e.originalPalette) e.palette = e.originalPalette;
                    else e.palette = ['#a855f7', '#9333ea', '#7e22ce'];
                }

            } else {
                // IDLE STATE
                if (e.originalPalette) e.palette = e.originalPalette;

                // Check Spawn Timer (Limit to 9 Minions)
                const spawnInterval = 15000;
                if (!e.lastAttack) e.lastAttack = Date.now();
                if (Date.now() - e.lastAttack > spawnInterval && myMinions.length < 9) {
                    // Start Charging
                    e.summonState = 1;
                    e.timer = Date.now() + 3000;
                    playSfx('warning');
                }
            }
        }
    }

    return { vx, vy };
}

export function updateUniquePentagon(e: Enemy, state: GameState, dist: number, dx: number, dy: number, currentSpd: number, pushX: number, pushY: number) {
    // Unique Pentagons use the same basic Hive logic as Normal ones
    // But they have "Rare" visuals like trails and higher speed

    // Standard Hive Update (Movement + Spawning + Guarding)
    const result = updateNormalPentagon(e, state, dist, dx, dy, currentSpd * 1.2, pushX, pushY); // 20% faster

    // Rare Visuals: Trails (After-images)
    if (state.frameCount % 5 === 0) {
        if (!e.trails) e.trails = [];
        e.trails.push({ x: e.x, y: e.y, alpha: 0.5, rotation: e.rotationPhase || 0 });
        if (e.trails.length > 5) e.trails.shift();
    }

    // Rare Visuals: Long Paint Trail (like Snitch)
    if (!e.longTrail) e.longTrail = [];
    if (state.frameCount % 3 === 0) {
        e.longTrail.push({ x: e.x, y: e.y });
        if (e.longTrail.length > 30) e.longTrail.shift();
    }

    return result;
}
