import type { GameState, Enemy } from '../types';
import { ARENA_CENTERS, isInMap } from '../MapLogic';
import { spawnParticles } from '../ParticleLogic';
import { playSfx } from '../AudioLogic';
import { handleEnemyDeath } from '../DeathLogic';

export function spawnMinion(state: GameState, parent: Enemy, isElite: boolean, count: number) {
    for (let i = 0; i < count; i++) {
        const offsetAngle = (Math.PI * 2 / count) * i;
        const dist = 60;
        const mx = parent.x + Math.cos(offsetAngle) * dist;
        const my = parent.y + Math.sin(offsetAngle) * dist;

        const minion: Enemy = {
            id: Math.random(),
            type: 'minion', // Type identifier
            shape: 'minion', // Logic identifier
            x: mx, y: my,
            size: 15,
            hp: Math.ceil(isElite ? parent.maxHp * 0.25 : parent.maxHp * 0.15),
            maxHp: Math.ceil(isElite ? parent.maxHp * 0.25 : parent.maxHp * 0.15),
            spd: parent.spd * 1.4,
            boss: false,
            bossType: 0,
            bossAttackPattern: 0,
            lastAttack: 0,
            dead: false,
            shellStage: 0,
            palette: (parent.originalPalette || parent.palette), // Always inherit parent colors (Era/Stable)
            pulsePhase: 0,
            rotationPhase: 0,
            parentId: parent.id,
            minionState: 0, // 0 = Orbiting/Spawning, 1 = Chasing
            spawnedAt: state.gameTime,
            stunOnHit: isElite, // Still keep the Stun mechanic if it's an Elite spawn
            vx: 0, vy: 0,
            knockback: { x: 0, y: 0 },
            isRare: false,
            isElite: false
        } as any;

        state.enemies.push(minion);
        spawnParticles(state, mx, my, '#FFFFFF', 5);
    }
}

export function updateMinion(e: Enemy, state: GameState, player: any, dx: number, dy: number, vx: number, vy: number) {
    const m = state.enemies.find(p => p.id === e.parentId);
    if (!m || m.dead) e.minionState = 1;

    // Launch Trigger: Player gets too close to Mother (Guard Mode)
    if (e.minionState === 0 && m) {
        const distToMother = Math.hypot(player.x - m.x, player.y - m.y);
        if (distToMother < 350) { // Removed m.isElite auto-launch to ensure guarding behavior
            e.minionState = 1;
            playSfx('shoot');
        }
    }

    if (e.minionState === 0 && m) {
        const aM = Math.atan2(player.y - m.y, player.x - m.x);
        const group = state.enemies.filter(n => n.parentId === m.id && n.minionState === 0 && !n.dead);
        const idx = group.indexOf(e), row = Math.floor((idx + 1) / 2), side = (idx === 0) ? 0 : (idx % 2 === 1 ? -1 : 1);
        const lX = 180 - (row * 28), lY = side * (row * 32), cA = Math.cos(aM), sA = Math.sin(aM);
        const tx = m.x + (lX * cA - lY * sA), ty = m.y + (lX * sA + lY * cA);
        vx = (tx - e.x) * 0.15; vy = (ty - e.y) * 0.15;
        e.rotationPhase = Math.atan2(player.y - e.y, player.x - e.x);
    } else {
        const lT = state.gameTime - (e.spawnedAt || 0), tA = Math.atan2(dy, dx), cMA = Math.atan2(vy || dy, vx || dx);
        let diff = tA - cMA; while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;
        const bA = cMA + diff * 0.08, sA = bA + Math.sin(lT * 8) * 0.4;
        vx = Math.cos(sA) * 6.0; vy = Math.sin(sA) * 6.0; e.rotationPhase = sA;
    }
    return { vx, vy };
}

export function updateSnitch(e: Enemy, state: GameState, player: any, timeS: number) {
    let vx = 0, vy = 0;
    const timeInP = state.gameTime - (e.rareTimer || e.spawnedAt || 0);
    if (timeInP > 30) {
        e.dead = true; state.rareSpawnActive = false;
        playSfx('rare-despawn'); return { vx: 0, vy: 0 };
    }
    const dToP = Math.hypot(player.x - e.x, player.y - e.y);
    if (e.rarePhase === 0) {
        const tSpd = player.speed * 0.8; e.spd = tSpd;
        if (e.spiralAngle === undefined) e.spiralAngle = Math.atan2(e.y - player.y, e.x - player.x);
        e.spiralAngle += 0.005;
        let tx = player.x + Math.cos(e.spiralAngle) * 1100, ty = player.y + Math.sin(e.spiralAngle) * 1100;
        if (!isInMap(tx, ty)) { tx -= (tx - player.x) * 0.2; ty -= (ty - player.y) * 0.2; }
        const tdx = tx - e.x, tdy = ty - e.y, tdist = Math.hypot(tdx, tdy);
        if (tdist > 1) { vx = (tdx / tdist) * e.spd; vy = (tdy / tdist) * e.spd; }
        if (dToP < 500) { e.rarePhase = 1; e.rareTimer = timeS; e.palette = ['#f97316', '#ea580c', '#c2410c']; playSfx('smoke-puff'); }
    } else {
        if (e.lockedTargetX === undefined || e.lockedTargetY === undefined || (Math.abs(e.x - e.lockedTargetX) < 50 && Math.abs(e.y - e.lockedTargetY) < 50)) {
            const a = Math.random() * Math.PI * 2, d = 500 + Math.random() * 300;
            let tx = player.x + Math.cos(a) * d, ty = player.y + Math.sin(a) * d;
            if (!isInMap(tx, ty)) { tx = ARENA_CENTERS[0].x; ty = ARENA_CENTERS[0].y; }
            e.lockedTargetX = tx; e.lockedTargetY = ty;
        }
        const tdx = (e.lockedTargetX || 0) - e.x, tdy = (e.lockedTargetY || 0) - e.y, tdist = Math.hypot(tdx, tdy);
        if (tdist > 1) { vx = (tdx / tdist) * e.spd; vy = (tdy / tdist) * e.spd; }
        if (dToP < 350 && (!e.tacticalTimer || timeS > e.tacticalTimer)) {
            const target = state.enemies.find(o => !o.dead && !o.boss && o.shape !== 'snitch' && Math.hypot(o.x - player.x, o.y - player.y) > dToP + 200);
            if (target) {
                const ox = e.x, oy = e.y; e.x = target.x; e.y = target.y; target.x = ox; target.y = oy;
                spawnParticles(state, ox, oy, ['#F0F0F0', '#808080'], 20);
                spawnParticles(state, e.x, e.y, ['#F0F0F0', '#808080'], 20);
                playSfx('smoke-puff'); e.tacticalTimer = timeS + 4.0; e.panicCooldown = timeS + 1.0;
            }
        }
    }
    if (dToP < 250) {
        const ang = Math.atan2(e.y - player.y, e.x - player.x);
        vx = Math.cos(ang) * e.spd * 2; vy = Math.sin(ang) * e.spd * 2;
        e.lockedTargetX = undefined;
    }
    if (e.panicCooldown && timeS < e.panicCooldown) { vx *= 2; vy *= 2; }

    // Snitch moves are handled by return
    return { vx, vy };
}

export function updateZombie(e: Enemy, state: GameState, step: number, onEvent?: (event: string, data?: any) => void) {
    const now = state.gameTime * 1000;
    const player = state.player;

    if (e.zombieHearts === undefined) e.zombieHearts = 3;

    if (e.zombieState === 'dead') {
        if (now >= (e.zombieTimer || 0)) {
            e.zombieState = 'rising';
            e.zombieTimer = now + 1500;
            playSfx('zombie-rise');
        }
        return;
    }
    if (e.zombieState === 'rising') {
        if (now >= (e.zombieTimer || 0)) {
            e.zombieState = 'active';
            e.zombieHearts = 3; // Reset hearts on rise
        }
        return;
    }

    // --- CLINGING STATE ---
    if (e.zombieState === 'clinging') {
        const target = state.enemies.find(o => o.id === e.zombieTargetId && !o.dead);
        if (!target) {
            e.zombieState = 'active';
            e.zombieTargetId = undefined;
        } else {
            // Position exactly on target
            e.x = target.x;
            e.y = target.y;
            e.vx = target.vx || 0;
            e.vy = target.vy || 0;

            // Apply Stun/Root
            target.frozen = 0.5; // Freeze for 0.5s every frame to keep it locked

            // Check if 3s passed since latching
            if (now >= (e.zombieTimer || 0)) {
                // Kill target
                target.hp = 0;
                target.dead = true;
                handleEnemyDeath(state, target, onEvent);

                // Consume 1 heart for "finishing" the target (or maybe only if touched?)
                // User said: "it doest it until he is touched 3 times". 
                // Let's make it so consuming an enemy is "safe", but being touched by OTHERS hurts.
                // Wait, "They only die after colliding with 3 enemies"
                // Let's say finishing 1 enemy = 1 heart loss.
                e.zombieHearts!--;

                if (e.zombieHearts! <= 0) {
                    e.dead = true;
                    spawnParticles(state, e.x, e.y, '#4ade80', 15);
                } else {
                    e.zombieState = 'active';
                    e.zombieTargetId = undefined;
                    playSfx('rare-kill');
                }
            }

            // Passive check: If OTHER enemies touch the zombie while it's busy
            const others = state.spatialGrid.query(e.x, e.y, e.size * 2);
            others.forEach(o => {
                if (o.id !== e.id && o.id !== e.zombieTargetId && !o.isZombie && !o.dead) {
                    const d = Math.hypot(o.x - e.x, o.y - e.y);
                    if (d < e.size + o.size) {
                        // Throttled heart loss (0.5s)
                        if (!e.lastAttack || now - e.lastAttack > 500) {
                            e.zombieHearts!--;
                            e.lastAttack = now;
                            spawnParticles(state, e.x, e.y, '#ef4444', 5);
                            if (e.zombieHearts! <= 0) {
                                e.dead = true;
                                spawnParticles(state, e.x, e.y, '#4ade80', 15);
                            }
                        }
                    }
                }
            });
            return;
        }
    }

    // --- ACTIVE STATE (FINDING PREY) ---
    // 1. Find NEAREST enemy
    let nearest: Enemy | null = null;
    let minDist = Infinity;

    state.enemies.forEach(other => {
        if (other.dead || other.isZombie || other.isFriendly || other.boss) return; // Bosses are immune to Grave Root
        const d = Math.hypot(other.x - e.x, other.y - e.y);
        if (d < minDist) {
            minDist = d;
            nearest = other;
        }
    });

    // 2. Frenzy Logic: If any enemy is near the player, enrage!
    const enemyNearPlayer = state.enemies.some(o => !o.dead && !o.isZombie && Math.hypot(o.x - player.x, o.y - player.y) < 300);
    e.isEnraged = enemyNearPlayer;

    if (nearest) {
        const target: Enemy = nearest;
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const dist = minDist;
        const angle = Math.atan2(dy, dx);

        let spd = 1.92 * 0.8; // 80% default
        if (e.isEnraged) spd = 1.92 * 2.5; // 250% dash (slightly more than 200% for impact)

        e.vx = (e.vx || 0) * 0.8 + Math.cos(angle) * spd * 0.2 * 60;
        e.vy = (e.vy || 0) * 0.8 + Math.sin(angle) * spd * 0.2 * 60;
        e.x += (e.vx || 0) * step;
        e.y += (e.vy || 0) * step;

        // Latch Trigger
        if (dist < e.size + target.size) {
            e.zombieState = 'clinging';
            e.zombieTargetId = target.id;
            e.zombieTimer = now + 3000; // 3 Seconds to "eat"
            playSfx('impact');
            spawnParticles(state, target.x, target.y, '#4ade80', 10);
        }
    }
}
