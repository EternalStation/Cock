import type { GameState, Enemy, ShapeType } from './types';
import { SHAPE_DEFS, PALETTES, PULSE_RATES, SHAPE_CYCLE_ORDER } from './constants';
import { isInMap, getArenaIndex, getRandomPositionInArena, ARENA_CENTERS } from './MapLogic';
import { playSfx } from './AudioLogic';
import { spawnParticles } from './ParticleLogic';
import { handleEnemyDeath } from './DeathLogic';

// Modular Enemy Logic
import { updateNormalCircle, updateNormalTriangle, updateNormalSquare, updateNormalDiamond, updateNormalPentagon, updateUniquePentagon } from './enemies/NormalEnemyLogic';
import { updateEliteCircle, updateEliteTriangle, updateEliteSquare, updateEliteDiamond, updateElitePentagon } from './enemies/EliteEnemyLogic';
import { updateBossEnemy } from './enemies/BossEnemyLogic';
import { updateZombie, updateSnitch, updateMinion } from './enemies/UniqueEnemyLogic';

// Helper to determine current game era params
function getProgressionParams(gameTime: number) {
    const minutes = Math.floor(gameTime / 60);
    const eraIndex = Math.floor(minutes / 15);
    const cycleIndex = Math.floor((minutes % 15) / 5);
    const shapeIndex = minutes % 5;

    // Cycle shapes: Circle -> Triangle -> Square -> Diamond -> Pentagon
    const shapeId = SHAPE_CYCLE_ORDER[shapeIndex];
    const shapeDef = SHAPE_DEFS[shapeId];

    // Era Palette (Green -> Blue -> Purple -> Orange -> Red)
    const eraPalette = PALETTES[eraIndex % PALETTES.length];
    const baseColors = eraPalette.colors; // [Bright, Medium, Dark]

    // Determine Active Colors based on Cycle (0-5m, 5-10m, 10-15m)
    let activeColors: string[];

    if (cycleIndex === 0) {
        // Cycle 1 (0-5m): Bright Core, Dim Inner, Dim Outer
        activeColors = [baseColors[0], baseColors[2], baseColors[2]];
    } else if (cycleIndex === 1) {
        // Cycle 2 (5-10m): Dim Core, Bright Inner, Dim Outer
        activeColors = [baseColors[2], baseColors[0], baseColors[2]];
    } else {
        // Cycle 3 (10-15m): Bright Core, Dim Inner, Bright Outer
        activeColors = [baseColors[0], baseColors[2], baseColors[0]];
    }

    // Pulse Speed
    const pulseDef = PULSE_RATES.find(p => minutes < p.time) || PULSE_RATES[PULSE_RATES.length - 1];

    return { shapeDef, activeColors, pulseDef };
}

export function updateEnemies(state: GameState, onEvent?: (event: string, data?: any) => void, step: number = 1 / 60) {
    const { enemies, player, gameTime } = state;
    const { shapeDef, pulseDef } = getProgressionParams(gameTime);

    // Spawning Logic
    const minutes = gameTime / 60;
    const baseSpawnRate = 1.4 + (minutes * 0.1);
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
        state.nextBossSpawnTime += 120; // 2 Minutes
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

export function spawnEnemy(state: GameState, x?: number, y?: number, shape?: ShapeType, isBoss: boolean = false) {
    const { player, gameTime } = state;
    const { shapeDef, activeColors } = getProgressionParams(gameTime);

    // Use provided shape OR respect game progression (shapeDef unlocks based on game time)
    const chosenShape: ShapeType = shape || shapeDef.type as ShapeType;

    // If specific position provided (cheat command), use it; otherwise calculate spawn location
    let spawnPos = (x !== undefined && y !== undefined) ? { x, y } : { x: player.x, y: player.y };
    const playerArena = getArenaIndex(player.x, player.y);
    let found = false;

    // Only calculate spawn position if not provided
    if (x === undefined || y === undefined) {
        // Try Ring around player valid in arena
        for (let i = 0; i < 8; i++) {
            const a = Math.random() * 6.28;
            const d = (isBoss ? 1500 : 1200) + Math.random() * 300;
            const tx = player.x + Math.cos(a) * d;
            const ty = player.y + Math.sin(a) * d;

            if (isInMap(tx, ty) && getArenaIndex(tx, ty) === playerArena) {
                spawnPos = { x: tx, y: ty };
                found = true;
                break;
            }

        }


        // Fallback: Random spot in Arena
        if (!found) {
            spawnPos = getRandomPositionInArena(playerArena);
        }

    }



    // Scaling
    const cycleCount = Math.floor(gameTime / 300);
    const hpMult = Math.pow(1.2, cycleCount) * SHAPE_DEFS[chosenShape].hpMult;
    const size = isBoss ? 60 : (20 * SHAPE_DEFS[chosenShape].sizeMult);
    const minutes = gameTime / 60;
    const baseHp = 50 * Math.pow(1.15, Math.floor(minutes));
    const hp = (isBoss ? baseHp * 15 : baseHp) * hpMult;

    const newEnemy: Enemy = {
        id: Math.random(),
        type: (isBoss ? 'boss' : chosenShape) as 'boss' | ShapeType,
        x: spawnPos.x, y: spawnPos.y,
        size,
        hp,
        maxHp: hp,
        spd: 2.4 * SHAPE_DEFS[chosenShape].speedMult,
        boss: isBoss,
        bossType: isBoss ? Math.floor(Math.random() * 2) : 0,
        bossAttackPattern: 0,
        dead: false,
        shape: chosenShape as ShapeType,
        shellStage: 2,
        palette: activeColors,
        pulsePhase: 0,
        rotationPhase: Math.random() * Math.PI * 2,
        lastAttack: Date.now() + Math.random() * 2000,
        timer: 0,
        summonState: 0,
        dodgeDir: Math.random() > 0.5 ? 1 : -1,
        wobblePhase: isBoss ? Math.random() * Math.PI * 2 : 0,
        jitterX: 0, jitterY: 0,
        glitchPhase: 0, crackPhase: 0, particleOrbit: 0,
        knockback: { x: 0, y: 0 },
        isRare: false,
        spawnedAt: state.gameTime
    };

    state.enemies.push(newEnemy);
}

export function spawnRareEnemy(state: GameState) {
    const { player } = state;
    // const { activeColors } = getProgressionParams(gameTime); // Not needed for fixed snitch

    // Spawn near player or random valid
    let spawnPos = { x: player.x, y: player.y };
    let found = false;
    const playerArena = getArenaIndex(player.x, player.y);

    for (let i = 0; i < 10; i++) {
        const a = Math.random() * 6.28;
        const d = 1150 + Math.random() * 100;
        const tx = player.x + Math.cos(a) * d;
        const ty = player.y + Math.sin(a) * d;
        if (isInMap(tx, ty) && getArenaIndex(tx, ty) === playerArena) {
            spawnPos = { x: tx, y: ty };
            found = true;
            break;
        }
    }
    if (!found) spawnPos = getRandomPositionInArena(playerArena);

    const { x, y } = spawnPos;

    // Always Snitch
    // const isPentagon = false; 

    // Scale HP based on time
    // const baseHp = 50 * Math.pow(1.15, Math.floor(state.gameTime / 60));
    // const hp = 1; 
    // Original code: const hp = isPentagon ? ... : 1;
    // So Snitch is 1 HP.

    const rareEnemy: Enemy = {
        id: Math.random(),
        type: 'snitch',
        x, y,
        hp: 1,
        maxHp: 1,
        spd: player.speed * 0.8,
        boss: false, bossType: 0, bossAttackPattern: 0, lastAttack: 0, dead: false,
        shape: 'snitch',
        shellStage: 2,
        palette: ['#FACC15', '#EAB308', '#CA8A04'],
        pulsePhase: 0, rotationPhase: 0, timer: Date.now(),
        isRare: true, size: 18,
        rarePhase: 0, rareTimer: state.gameTime, rareIntent: 0, rareReal: true, canBlock: false,
        trails: [], longTrail: [{ x, y }], wobblePhase: 0,
        knockback: { x: 0, y: 0 },
        glitchPhase: 0, crackPhase: 0, particleOrbit: 0,
        spawnedAt: state.gameTime
    };

    state.enemies.push(rareEnemy);
    playSfx('rare-spawn');
    state.rareSpawnActive = true;
}

function manageRareSpawnCycles(state: GameState) {
    const { gameTime, rareSpawnCycle, rareSpawnActive } = state;
    if (rareSpawnActive) return;

    const nextSpawnTime = 60 + (rareSpawnCycle * 120);

    if (gameTime >= nextSpawnTime) {
        spawnRareEnemy(state);
        state.rareSpawnCycle++;
    }
}

// Updated signature to support Strong Minions

export function spawnShield(state: GameState, x: number, y: number) {
    const shield: Enemy = {
        id: Math.random(),
        type: 'square', // Acts as a block
        x, y,
        size: 15,
        hp: 1, // Single hit destruction
        maxHp: 1,
        spd: 0, // Stationary
        boss: false, bossType: 0, bossAttackPattern: 0, lastAttack: 0, dead: false,
        shape: 'square',
        shellStage: 0,
        palette: ['#475569', '#334155', '#1e293b'], // Slate
        pulsePhase: 0,
        rotationPhase: Math.random() * 6.28,
        spawnedAt: state.gameTime,
        knockback: { x: 0, y: 0 },
        isRare: false,
        isNeutral: true // Tag as neutral for auto-aim (ignored)
    };
    state.enemies.push(shield);
}

function scanForMerges(state: GameState) {
    const { enemies, spatialGrid } = state;
    for (const e of enemies) {
        if (e.dead || e.boss || e.isElite || e.isRare || e.mergeState) continue;
        if (e.mergeCooldown && state.gameTime < e.mergeCooldown) continue;
        const neighbors = spatialGrid.query(e.x, e.y, 100);
        const candidates = neighbors.filter(n =>
            n.shape === e.shape && !n.dead && !n.boss && !n.isElite && !n.isRare && !n.mergeState && !n.isNeutral &&
            n.shape !== 'minion' && (!n.mergeCooldown || state.gameTime >= n.mergeCooldown)
        );
        const threshold = e.shape === 'pentagon' ? 5 : 10;
        if (candidates.length >= threshold) {
            const cluster = candidates.slice(0, threshold);
            const mergeId = `merge_${Math.random()}`;
            cluster.forEach((c, index) => {
                c.mergeState = 'warming_up';
                c.mergeId = mergeId;
                c.mergeTimer = state.gameTime + 3;
                c.mergeHost = index === 0;
                c.mergeCooldown = undefined;
            });
            playSfx('merge-start');
            return;
        }
    }
}

function manageMerges(state: GameState) {
    const { enemies } = state;
    const mergeGroups = new Map<string, Enemy[]>();
    enemies.forEach(e => {
        if (e.mergeState === 'warming_up' && e.mergeId && !e.dead) {
            if (!mergeGroups.has(e.mergeId)) mergeGroups.set(e.mergeId, []);
            mergeGroups.get(e.mergeId)!.push(e);
        }
    });

    mergeGroups.forEach((group, mergeId) => {
        const aliveEnemies = group.filter(e => !e.dead && e.hp > 0);
        const sample = group[0];
        const threshold = (sample && sample.shape === 'pentagon') ? 5 : 10;

        if (aliveEnemies.length < threshold) {
            const firstAlive = aliveEnemies[0];
            if (firstAlive) {
                const nearby = state.spatialGrid.query(firstAlive.x, firstAlive.y, 100);
                const recruits = nearby.filter(n =>
                    n.shape === firstAlive.shape && !n.dead && !n.boss && !n.isElite && !n.isRare && !n.mergeState
                ).slice(0, threshold - aliveEnemies.length);
                recruits.forEach((r) => {
                    r.mergeState = 'warming_up';
                    r.mergeId = mergeId;
                    r.mergeTimer = firstAlive.mergeTimer;
                    r.mergeHost = false;
                    r.mergeCooldown = undefined;
                });
                aliveEnemies.push(...recruits);
            }
            if (aliveEnemies.length < threshold) {
                group.forEach(e => {
                    e.mergeState = 'none'; e.mergeTimer = 0; e.mergeId = undefined;
                    e.mergeHost = false; e.mergeCooldown = state.gameTime + 2;
                });
                return;
            }
        }

        const first = aliveEnemies[0];
        if (state.gameTime >= (first.mergeTimer || 0)) {
            const host = aliveEnemies.find(e => e.mergeHost);
            if (!host) return;
            host.mergeState = 'none'; host.isElite = true; host.eliteState = 0;
            host.spawnedAt = state.gameTime;
            host.lastAttack = Date.now() + 3000;
            host.size *= 1.2;
            const mult = host.shape === 'pentagon' ? 6 : 12;
            host.hp *= mult; host.maxHp *= mult; host.hp = host.maxHp;
            host.xpRewardMult = mult;
            aliveEnemies.forEach(e => {
                if (e !== host) { e.dead = true; e.hp = 0; }
            });
            playSfx('merge-complete');
        }
    });
}
