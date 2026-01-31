import type { GameState, Enemy } from './types';
import { isInMap, ARENA_CENTERS } from './MapLogic';
import { playSfx } from './AudioLogic';
import { spawnParticles } from './ParticleLogic';
import { handleEnemyDeath } from './DeathLogic';

// Modular Enemy Logic
import { updateNormalCircle, updateNormalTriangle, updateNormalSquare, updateNormalDiamond, updateNormalPentagon, updateUniquePentagon } from './enemies/NormalEnemyLogic';
import { updateEliteCircle, updateEliteTriangle, updateEliteSquare, updateEliteDiamond, updateElitePentagon } from './enemies/EliteEnemyLogic';
import { updateBossEnemy } from './enemies/BossEnemyLogic';
import { GAME_CONFIG } from './GameConfig';
import { getProgressionParams, spawnEnemy, manageRareSpawnCycles } from './enemies/EnemySpawnLogic';
import { scanForMerges, manageMerges } from './enemies/EnemyMergeLogic';
import { updateZombie, updateSnitch, updateMinion } from './enemies/UniqueEnemyLogic';

// Helper to determine current game era params
export { spawnEnemy, spawnRareEnemy } from './enemies/EnemySpawnLogic';


export function updateEnemies(state: GameState, onEvent?: (event: string, data?: any) => void, step: number = 1 / 60) {
    const { enemies, player, gameTime } = state;
    const { shapeDef, pulseDef } = getProgressionParams(gameTime);

    // Spawning Logic
    const minutes = gameTime / 60;
    const baseSpawnRate = GAME_CONFIG.ENEMY.BASE_SPAWN_RATE + (minutes * GAME_CONFIG.ENEMY.SPAWN_RATE_PER_MINUTE);
    let actualRate = baseSpawnRate * shapeDef.spawnWeight;
    if (state.currentArena === 1) actualRate *= 1.15; // +15% Spawn Rate in Combat Hex

    if (Math.random() < actualRate / 60 && state.portalState !== 'transferring') {
        spawnEnemy(state);
    }

    // Rare Spawning Logic
    if (state.portalState !== 'transferring') {
        manageRareSpawnCycles(state);
    }

    // Boss Spawning
    if (gameTime >= state.nextBossSpawnTime && state.portalState !== 'transferring') {
        // Fix: Pass arguments correctly (x, y, shape, isBoss)
        spawnEnemy(state, undefined, undefined, undefined, true);
        state.nextBossSpawnTime += GAME_CONFIG.ENEMY.BOSS_SPAWN_INTERVAL; // 2 Minutes
    }

    // --- SPATIAL GRID UPDATE ---
    state.spatialGrid.clear();
    enemies.forEach(e => {
        if (!e.dead) state.spatialGrid.add(e);
    });

    // --- MERGING LOGIC ---
    // Only check once per second (approx) to save perf, or spread check?
    // User wants "3 second warning", so continuous monitoring is needed once triggered.
    // Let's check every 15 frames for new clusters, but update existing clusters every frame.

    // 1. Manage Active Clusters
    manageMerges(state);

    // 2. Scan for new clusters (Throttled)
    if (Math.floor(state.gameTime * 60) % 30 === 0) { // Check every 0.5s
        scanForMerges(state);
    }

    enemies.forEach(e => {
        if (e.dead) return;

        // --- ZOMBIE LOGIC ---
        if (e.isZombie) {
            updateZombie(e, state, step, onEvent);
            return;
        }

        if (e.frozen && e.frozen > 0) {
            e.frozen -= 1 / 60;
            return;
        }

        // Reset Frame-based Multipliers
        e.takenDamageMultiplier = 1.0;

        // Wall collision - instant death if out of bounds
        if (!isInMap(e.x, e.y)) {
            e.dead = true;
            e.hp = 0;
            spawnParticles(state, e.x, e.y, e.palette[0], 20);
            return;
        }

        // Knockback handling
        if (e.knockback && (e.knockback.x !== 0 || e.knockback.y !== 0)) {
            e.x += e.knockback.x;
            e.y += e.knockback.y;
            e.knockback.x *= 0.9;
            e.knockback.y *= 0.9;
            if (Math.abs(e.knockback.x) < 0.1) e.knockback.x = 0;
            if (Math.abs(e.knockback.y) < 0.1) e.knockback.y = 0;
            return;
        }

        // Target Determination (Mutual Aggression)
        let targetX = player.x;
        let targetY = player.y;
        let dist = Math.hypot(player.x - e.x, player.y - e.y);
        let targetZombie: Enemy | null = null;

        // Enemies target nearest: Player or Active Zombie
        for (const z of state.enemies) {
            if (z.isZombie && z.zombieState === 'active' && !z.dead) {
                if (e.boss) continue;
                const zDist = Math.hypot(z.x - e.x, z.y - e.y);
                if (zDist < dist) {
                    dist = zDist;
                    targetX = z.x;
                    targetY = z.y;
                    targetZombie = z;
                }
            }
        }

        const dx = targetX - e.x;
        const dy = targetY - e.y;
        if (dist === 0) dist = 0.001;

        // Collision with Zombie
        if (targetZombie && dist < e.size + targetZombie.size) {
            const now = state.gameTime * 1000;
            if (!e.lastAttack || now - e.lastAttack > 500) {
                // Mutual Damage: 100% HP exchange
                const zombieHp = e.hp;
                const enemyHp = targetZombie.hp;

                targetZombie.hp -= zombieHp; // Enemy takes 100% of Zombie HP
                e.hp -= enemyHp; // Zombie takes 100% of Enemy HP

                // Mark enemy as infected
                e.infected = true;

                e.lastAttack = now;
                playSfx('impact');
                spawnParticles(state, targetZombie.x, targetZombie.y, '#4ade80', 5);

                if (targetZombie.hp <= 0) targetZombie.dead = true;
                if (e.hp <= 0) e.dead = true;
            }
        }

        // Separator
        let pushX = 0;
        let pushY = 0;

        // Optimized Push Logic - Only run for enemies near player and stagger checks
        const shouldCheckPush = dist < 1000 && (e.id + state.frameCount) % 2 === 0;

        if (shouldCheckPush) {
            const nearbyEnemies = state.spatialGrid.query(e.x, e.y, e.size * 3);

            nearbyEnemies.forEach(other => {
                if (e === other) return;
                const odx = e.x - other.x;
                const ody = e.y - other.y;
                // Quick box check before expensive hypot
                if (Math.abs(odx) < e.size + other.size && Math.abs(ody) < e.size + other.size) {
                    const odist = Math.sqrt(odx * odx + ody * ody);
                    // Push radius usually 2*size
                    if (odist < e.size + other.size) {
                        const pushDist = (e.size + other.size) - odist;
                        if (odist > 0.001) { // Avoid div by zero
                            pushX += (odx / odist) * pushDist * 0.01; // Slightly increased for staggered frames
                            pushY += (ody / odist) * pushDist * 0.01;
                        }
                    }
                }
            });
        }

        // Apply Speed Modifiers
        // Speed - elites move at same speed as normal enemies generally, unless specific shape logic overrides
        let currentSpd = e.spd;
        if (e.shape === 'circle') currentSpd *= 1.5;

        // Apply Slow Factor (reset each frame by logic, or persistence?)
        // If we set e.slowFactor in the loop, we use it here.
        if (e.slowFactor) {
            currentSpd *= (1 - e.slowFactor);
            // Decay slow factor for smooth recovery or just expect it to be re-applied?
            // Let's assume re-applied every frame by Puddle/Epi.
            e.slowFactor = 0; // Reset for next frame
        }

        // Calculate Velocity using Delegates
        let v = { vx: 0, vy: 0 };
        const isFeared = e.fearedUntil && e.fearedUntil > state.gameTime;

        if (isFeared) {
            // Run Away Behavior (Fear)
            const angle = Math.atan2(dy, dx);
            v = {
                vx: -Math.cos(angle) * currentSpd,
                vy: -Math.sin(angle) * currentSpd
            };
        } else if (e.boss) {
            v = updateBossEnemy(e, currentSpd, dx, dy, pushX, pushY);
        } else if (e.shape === 'minion') {
            v = updateMinion(e, state, player, dx, dy, 0, 0);
        } else if (e.shape === 'snitch') {
            v = updateSnitch(e, state, player, state.gameTime);
        } else if (e.isRare && e.shape === 'pentagon') {
            v = updateUniquePentagon(e, state, dist, dx, dy, currentSpd, pushX, pushY);
        } else if (e.isElite) {
            switch (e.shape) {
                case 'circle': v = updateEliteCircle(e, state, player, dist, dx, dy, currentSpd, pushX, pushY); break;
                case 'triangle': v = updateEliteTriangle(e, state, dist, dx, dy, currentSpd, pushX, pushY); break;
                case 'square': v = updateEliteSquare(e, state, currentSpd, dx, dy, pushX, pushY); break;
                case 'diamond': v = updateEliteDiamond(e, state, player, dist, dx, dy, currentSpd, pushX, pushY, onEvent); break;
                case 'pentagon': v = updateElitePentagon(e, state, dist, dx, dy, currentSpd, pushX, pushY, onEvent); break;
            }
        } else {
            switch (e.shape) {
                case 'circle': v = updateNormalCircle(e, player, dx, dy, currentSpd, pushX, pushY); break;
                case 'triangle': v = updateNormalTriangle(e, dx, dy, pushX, pushY); break;
                case 'square': v = updateNormalSquare(currentSpd, dx, dy, pushX, pushY); break;
                case 'diamond': v = updateNormalDiamond(e, state, dist, dx, dy, currentSpd, pushX, pushY); break;
                case 'pentagon': v = updateNormalPentagon(e, state, dist, dx, dy, currentSpd, pushX, pushY); break;
            }
        }

        let vx = v.vx;
        let vy = v.vy;

        // --- STATUS OVERRIDES ---
        // (Removed old broken fear logic)


        // --- GLOBAL LOGIC ---
        e.x += (Math.random() - 0.5);
        e.y += (Math.random() - 0.5);

        const nX = e.x + vx;
        const nY = e.y + vy;

        if (isInMap(nX, nY)) {
            e.x = nX; e.y = nY;
        } else {
            if (e.shape === 'snitch' && e.rareReal) {
                const c = ARENA_CENTERS[0];
                const a = Math.atan2(c.y - e.y, c.x - e.x);
                e.x += Math.cos(a) * 50; e.y += Math.sin(a) * 50;
            } else {
                handleEnemyDeath(state, e, onEvent);
                return;
            }
        }

        e.pulsePhase = (e.pulsePhase + (Math.PI * 2) / pulseDef.interval) % (Math.PI * 2);
        e.rotationPhase = (e.rotationPhase || 0) + 0.01;
        if (e.hp <= 0 && !e.dead) handleEnemyDeath(state, e, onEvent);
    });
}


