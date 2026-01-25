import type { GameState, Enemy, ShapeType } from './types';
import { SHAPE_DEFS, PALETTES, PULSE_RATES, SHAPE_CYCLE_ORDER } from './constants';
import { isInMap, getArenaIndex, getRandomPositionInArena, ARENA_CENTERS, ARENA_RADIUS } from './MapLogic';
import { spawnEnemyBullet } from './ProjectileLogic';
import { playSfx } from './AudioLogic';
import { spawnParticles } from './ParticleLogic';
import { calcStat } from './MathUtils';


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

export function updateEnemies(state: GameState, onEvent?: (event: string, data?: any) => void) {
    const { enemies, player, gameTime } = state;
    const { shapeDef, pulseDef } = getProgressionParams(gameTime);

    // Spawning Logic
    const minutes = gameTime / 60;
    const baseSpawnRate = 1.4 + (minutes * 0.1);
    const actualRate = baseSpawnRate * shapeDef.spawnWeight;

    if (Math.random() < actualRate / 60) {
        spawnEnemy(state);
    }

    // Rare Spawning Logic
    manageRareSpawnCycles(state);

    // Boss Spawning
    if (gameTime >= state.nextBossSpawnTime) {
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
        if (e.frozen && e.frozen > 0) {
            e.frozen -= 1 / 60;
            return;
        }

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

        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy) || 0.001; // Prevent div by zero

        let speed = e.spd; // FIXED: Using 'spd' instead of 'speed'

        // Snitch Logic (Phase 0 handled in switch)
        if (e.isRare && e.rarePhase === 0) {
            // No return here anymore, fall through to switch
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

        // Basic Tracking (Overridden by behaviors below)
        let vx = (dx / dist) * speed + pushX;
        let vy = (dy / dist) * speed + pushY;

        // Apply Speed Modifiers
        // Speed - elites move at same speed as normal enemies
        let currentSpd = e.spd;
        if (e.shape === 'circle') currentSpd *= 1.5;

        // --- BEHAVIOR OVERRIDES ---
        switch (e.shape) {
            case 'circle':
                // Minion case removed to allow new logic in 2nd switch to run
                if (e.timer && Date.now() < e.timer) return;

                if (e.spiralRadius && e.spiralRadius > 10) {
                    const angleToPlayer = Math.atan2(dy, dx);
                    const spiralSpeed = 1.125;
                    const rotationSpeed = 0.0225;
                    e.spiralAngle = (e.spiralAngle || 0) + rotationSpeed;
                    e.spiralRadius -= spiralSpeed;
                    e.rotationPhase = angleToPlayer;
                    // Set Velocity implicitly by setting Position
                    const tx = player.x + Math.cos(e.spiralAngle) * e.spiralRadius;
                    const ty = player.y + Math.sin(e.spiralAngle) * e.spiralRadius;
                    vx = tx - e.x;
                    vy = ty - e.y;
                    if (e.spiralRadius < 20) e.spiralRadius = 0;
                } else {
                    if (e.isElite) {
                        // ELITE SKILL: BULL CHARGE
                        // State 0: Tracking (Normal)
                        // State 1: Locking (Warning)
                        // State 2: Charging (Dash)
                        if (!e.eliteState) e.eliteState = 0;

                        if (e.eliteState === 0) {
                            // Tracking Phase
                            if (dist < 600 && (!e.timer || Date.now() > e.timer)) { // Increased range
                                e.eliteState = 1;
                                e.timer = Date.now() + 500; // 0.5s lock-in (changed from 1s)
                                playSfx('rare-spawn'); // Warning sound reuse
                                // Store original palette before changing
                                e.originalPalette = e.palette;
                                e.palette = ['#EF4444', '#B91C1C', '#991B1B']; // Angry Red
                            } else {
                                // Normal movement
                                const angleToPlayer = Math.atan2(dy, dx);
                                vx = Math.cos(angleToPlayer) * currentSpd + pushX;
                                vy = Math.sin(angleToPlayer) * currentSpd + pushY;
                            }
                        } else if (e.eliteState === 1) {
                            // Locking Phase - Frozen, RED
                            vx = 0; vy = 0;
                            e.rotationPhase = (e.rotationPhase || 0) + 0.2; // Fast spin
                            if (Date.now() > e.timer!) {
                                // Remember player coordinates at 0.5s mark
                                const targetDx = player.x - e.x;
                                const targetDy = player.y - e.y;
                                const targetAngle = Math.atan2(targetDy, targetDx);

                                // Store locked target with 200px overshoot (increased from 100px)
                                e.lockedTargetX = player.x + Math.cos(targetAngle) * 200;
                                e.lockedTargetY = player.y + Math.sin(targetAngle) * 200;

                                // Store the angle to charge direction
                                e.dashState = targetAngle;

                                // Transition to charge
                                e.eliteState = 2;
                                e.timer = Date.now() + 500; // 0.5s rush
                                playSfx('boss-fire');
                            }
                        } else if (e.eliteState === 2) {
                            // Charging Phase - rush toward locked coordinates
                            if (e.lockedTargetX !== undefined && e.lockedTargetY !== undefined) {
                                const remainDx = e.lockedTargetX - e.x;
                                const remainDy = e.lockedTargetY - e.y;
                                const remainDist = Math.hypot(remainDx, remainDy);

                                if (remainDist > 10) {
                                    // Still moving toward target
                                    const angle = Math.atan2(remainDy, remainDx);
                                    const chargeSpeed = 600 / 60; // 600 pixels per second (increased 50%)
                                    vx = Math.cos(angle) * chargeSpeed;
                                    vy = Math.sin(angle) * chargeSpeed;

                                    spawnParticles(state, e.x, e.y, '#EF4444', 1);
                                } else {
                                    // Reached target - end charge
                                    e.eliteState = 0;
                                    e.timer = Date.now() + 5000; // 5s Cooldown
                                    e.palette = e.originalPalette || e.palette;
                                    e.lockedTargetX = undefined;
                                    e.lockedTargetY = undefined;
                                    e.dashState = undefined;
                                }
                            }
                        }
                    } else {
                        // Standard tracking + swarm
                        const angleToPlayer = Math.atan2(dy, dx);
                        vx = Math.cos(angleToPlayer) * currentSpd + pushX;
                        vy = Math.sin(angleToPlayer) * currentSpd + pushY;
                    }
                }
                break;
            case 'triangle':
                // Aggressive Dash Logic (only for normal triangles, not elites)
                if (!e.isElite) {
                    if (!e.timer) e.timer = Date.now();
                    if (Date.now() - e.lastAttack > 5000) {
                        e.spd = 18;
                        e.lastAttack = Date.now();
                    }
                }
                const baseTriSpd = 1.7 * SHAPE_DEFS['triangle'].speedMult;
                if (e.spd > baseTriSpd) e.spd *= 0.90;
                else e.spd = baseTriSpd;

                if (e.isElite) {
                    // ELITE SKILL: WHIRLWIND
                    // Initialize state
                    if (!e.eliteState) e.eliteState = 0;

                    if (e.eliteState === 0) {
                        // Cooldown phase
                        if ((!e.timer || Date.now() > e.timer) && dist < 600) { // Increased activation range
                            e.eliteState = 1;
                            e.timer = Date.now() + 3500; // 3.5s Whirlwind (reduced from 5s)
                            e.originalPalette = e.palette;
                            e.palette = ['#FCD34D', '#FBBF24', '#F59E0B']; // Gold
                        }
                        // Normal movement during cooldown
                        const angleToPlayerT = Math.atan2(dy, dx);
                        vx = Math.cos(angleToPlayerT) * e.spd + pushX;
                        vy = Math.sin(angleToPlayerT) * e.spd + pushY;
                    } else if (e.eliteState === 1) {
                        // Spinning - Gold, constant fast zigzag movement toward player
                        e.rotationPhase = (e.rotationPhase || 0) + 0.5; // Super fast spin
                        // Fast zigzag movement toward player with constant speed
                        const angleToPlayer = Math.atan2(dy, dx);
                        const zigzag = Math.sin(Date.now() / 100) * 0.5; // Random zigzag
                        const moveAngle = angleToPlayer + zigzag;
                        const fastSpeed = currentSpd * 2.55; // 2.55x speed (reduced 15% from 3x)
                        vx = Math.cos(moveAngle) * fastSpeed + pushX;
                        vy = Math.sin(moveAngle) * fastSpeed + pushY;

                        spawnParticles(state, e.x, e.y, '#FCD34D', 1);

                        if (Date.now() > e.timer!) {
                            // Reset to normal state
                            e.eliteState = 0;
                            e.timer = Date.now() + 5000; // 5s Cooldown
                            e.palette = e.originalPalette || e.palette;
                            // Reset speed to normal to prevent lingering velocity
                            vx = 0;
                            vy = 0;
                        }
                    }
                } else {
                    const angleToPlayerT = Math.atan2(dy, dx);
                    vx = Math.cos(angleToPlayerT) * e.spd + pushX;
                    vy = Math.sin(angleToPlayerT) * e.spd + pushY;
                }
                break;
            case 'square':
                if (e.isElite) {
                    // ELITE SKILL: THORNS (Passive)
                    // Movement is slow but unstoppable
                    const angleToPlayerS = Math.atan2(dy, dx);
                    vx = Math.cos(angleToPlayerS) * (currentSpd * 0.5) + pushX;
                    vy = Math.sin(angleToPlayerS) * (currentSpd * 0.5) + pushY;

                    // Visual Spike effect
                    if (Math.random() < 0.1) {
                        spawnParticles(state, e.x + (Math.random() - 0.5) * e.size * 2, e.y + (Math.random() - 0.5) * e.size * 2, '#94A3B8', 1);
                    }
                } else {
                    const angleToPlayerS = Math.atan2(dy, dx);
                    vx = Math.cos(angleToPlayerS) * currentSpd + pushX;
                    vy = Math.sin(angleToPlayerS) * currentSpd + pushY;
                }
                break;
            case 'diamond':
                if (e.isElite) {
                    // ELITE SKILL: HYPER BEAM
                    const angleToPlayerD = Math.atan2(dy, dx);

                    // Keep distance (with wall check)
                    const nearestCenter = ARENA_CENTERS.reduce((best, center) => {
                        const distToCenter = Math.hypot(e.x - center.x, e.y - center.y);
                        return distToCenter < Math.hypot(e.x - best.x, e.y - best.y) ? center : best;
                    }, ARENA_CENTERS[0]);

                    const distToCenter = Math.hypot(e.x - nearestCenter.x, e.y - nearestCenter.y);
                    const distToWall = ARENA_RADIUS - distToCenter;

                    const veryCloseToWall = distToWall < 500;

                    // Check if escaping (using lockedTargetX as escape flag - 0 means escaping)
                    const isEscaping = e.lockedTargetX === 0 && e.lockedTargetY && Date.now() < e.lockedTargetY;

                    if (isEscaping) {
                        // Escape dash active
                        vx = Math.cos(e.dashState || 0) * currentSpd * 2;
                        vy = Math.sin(e.dashState || 0) * currentSpd * 2;
                    } else if (veryCloseToWall && dist < 900 && (!e.lastDodge || Date.now() - e.lastDodge > 3000)) {
                        // Trapped - initiate escape (max once per 3 seconds)
                        const angleToCenter = Math.atan2(nearestCenter.y - e.y, nearestCenter.x - e.x);
                        const angleAwayFromPlayer = angleToPlayerD + Math.PI;
                        const escapeAngle = (angleToCenter + angleAwayFromPlayer) / 2;

                        e.dashState = escapeAngle;
                        e.lockedTargetX = 0; // Flag for escape mode
                        e.lockedTargetY = Date.now() + 2000; // Escape timer
                        e.lastDodge = Date.now(); // Mark escape time

                        vx = Math.cos(escapeAngle) * currentSpd * 2;
                        vy = Math.sin(escapeAngle) * currentSpd * 2;
                    } else {
                        // Clear escape state
                        if (e.lockedTargetX === 0) {
                            e.lockedTargetX = undefined;
                            e.lockedTargetY = undefined;
                        }

                        // Normal kiting
                        let distGoal = 600;
                        const distFactor = (dist - distGoal) / 100;
                        vx = Math.cos(angleToPlayerD) * distFactor * currentSpd;
                        vy = Math.sin(angleToPlayerD) * distFactor * currentSpd;
                    }

                    if (!e.eliteState) e.eliteState = 0;

                    if (e.eliteState === 0) {
                        // Charge Up - Lock player coordinates NOW
                        if (Date.now() - (e.lastAttack || 0) > 3600) { // 3.6s cooldown (20% slower)
                            // Lock the CURRENT player position for the laser
                            const angleToPlayer = Math.atan2(dy, dx);
                            e.dashState = angleToPlayer; // Store locked angle

                            e.eliteState = 1;
                            e.timer = Date.now() + 1000; // 1s delay before firing
                            playSfx('boss-fire');
                        }
                    } else if (e.eliteState === 1) {
                        // Charging: Locked coordinates stored, waiting 1.5s before firing
                        vx = 0; vy = 0;
                        if (Date.now() > e.timer!) {
                            // Fire laser in the direction locked 1.5 seconds ago
                            e.eliteState = 2;
                            e.timer = Date.now() + 1500; // 1.5s Laser Duration
                        }
                    } else if (e.eliteState === 2) {
                        // Firing Laser Beam
                        vx = 0; vy = 0;

                        // Store laser info for renderer (will be picked up by render logic)
                        e.lockedTargetX = e.x + Math.cos(e.dashState || 0) * 2000; // Laser end point
                        e.lockedTargetY = e.y + Math.sin(e.dashState || 0) * 2000;

                        // Damage player if in laser path
                        const laserAngle = e.dashState || 0;
                        const px = player.x - e.x;
                        const py = player.y - e.y;
                        const playerDist = Math.hypot(px, py);
                        const playerAngle = Math.atan2(py, px);
                        const angleDiff = Math.abs(playerAngle - laserAngle);

                        // Hit if player is in laser cone (within 0.1 radians and 2000px range)
                        if (angleDiff < 0.1 && playerDist < 2000) {
                            // Deal damage every few frames
                            if (!e.laserTick || Date.now() - e.laserTick > 100) {
                                const minutes = state.gameTime / 60;
                                const dmgMult = 1 + (Math.floor(minutes / 5) * 0.5);
                                const rawTickDmg = Math.floor(5 * dmgMult); // 5 base, +50% per 5min
                                const armor = calcStat(player.arm);
                                const tickDmg = Math.max(0, rawTickDmg - armor);

                                player.curHp -= tickDmg;
                                player.damageTaken += tickDmg;
                                e.laserTick = Date.now();

                                // Check for death
                                if (player.curHp <= 0 && !state.gameOver) {
                                    player.curHp = 0;
                                    state.gameOver = true;
                                    if (onEvent) onEvent('game_over');
                                }
                            }
                        }

                        if (Date.now() > e.timer!) {
                            e.eliteState = 0;
                            e.lastAttack = Date.now();
                        }
                    }

                } else {
                    // Diamond standard behavior
                    const angleToPlayerD = Math.atan2(dy, dx);
                    // Dynamic distance goal: keep between 500 and 900
                    let distGoal = 700;
                    if (dist < 500) distGoal = 800; // Back off
                    if (dist > 900) distGoal = 600; // Close in

                    // Check distance to nearest arena wall (500px minimum)
                    const nearestCenter = ARENA_CENTERS.reduce((best, center) => {
                        const distToCenter = Math.hypot(e.x - center.x, e.y - center.y);
                        return distToCenter < Math.hypot(e.x - best.x, e.y - best.y) ? center : best;
                    }, ARENA_CENTERS[0]);

                    const distToCenter = Math.hypot(e.x - nearestCenter.x, e.y - nearestCenter.y);
                    const distToWall = ARENA_RADIUS - distToCenter;

                    const veryCloseToWall = distToWall < 500; // Emergency at 500px

                    // Randomized Dodge (3-5s)
                    if (!e.timer || Date.now() > e.timer) {
                        e.dodgeDir = Math.random() > 0.5 ? 1 : -1;
                        e.timer = Date.now() + 3000 + Math.random() * 2000;
                    }

                    const strafeAngle = angleToPlayerD + (e.dodgeDir || 1) * Math.PI / 2;
                    const distFactor = (dist - distGoal) / 100;

                    // Wall avoidance with escape dash
                    // Check if currently in escape dash mode (using dodgeCooldown as timer)
                    const isEscaping = e.dodgeCooldown && Date.now() < e.dodgeCooldown;

                    if (isEscaping) {
                        // Fast escape dash - move away quickly
                        vx = Math.cos(e.dashState || 0) * currentSpd * 2;
                        vy = Math.sin(e.dashState || 0) * currentSpd * 2;
                    } else if (veryCloseToWall && dist < 900) {
                        // Trapped between wall and player - initiate 2s escape dash
                        const angleToCenter = Math.atan2(nearestCenter.y - e.y, nearestCenter.x - e.x);
                        const angleAwayFromPlayer = angleToPlayerD + Math.PI;
                        // Combine both angles to escape diagonally
                        const escapeAngle = (angleToCenter + angleAwayFromPlayer) / 2;

                        e.dashState = escapeAngle; // Store escape direction
                        e.dodgeCooldown = Date.now() + 2000; // Escape for 2 seconds

                        // Start moving immediately
                        vx = Math.cos(escapeAngle) * currentSpd * 2;
                        vy = Math.sin(escapeAngle) * currentSpd * 2;
                    } else {
                        // Normal kiting behavior
                        vx = Math.cos(strafeAngle) * currentSpd + Math.cos(angleToPlayerD) * distFactor * currentSpd;
                        vy = Math.sin(strafeAngle) * currentSpd + Math.cos(angleToPlayerD) * distFactor * currentSpd;
                    }

                    if (Date.now() - (e.lastAttack || 0) > 6000) { // 6s cooldown (unchanged)
                        // Scaling: Base 20, +50% every 5m
                        const minutes = state.gameTime / 60;
                        const dmgMult = 1 + (Math.floor(minutes / 5) * 0.5);
                        const finalDmg = 20 * dmgMult;

                        // Use original palette (Green) if available, so bullets match body not angry state
                        // Use baseColor if available (most reliable), fallback to originalPalette, then palette
                        const bulletColor = e.baseColor || (e.originalPalette ? e.originalPalette[0] : e.palette[0]);
                        spawnEnemyBullet(state, e.x, e.y, angleToPlayerD, finalDmg, bulletColor);
                        e.lastAttack = Date.now();
                    }
                }
                break;
            case 'pentagon':
                const motherAge = state.gameTime - (e.spawnedAt || 0);
                const myMinions = state.enemies.filter(m => m.parentId === e.id && !m.dead);
                const maxMinions = e.isElite ? 15 : 9;

                // 1. Summoning Logic (Stops after 60s)
                if (motherAge < 60 && myMinions.length < maxMinions) {
                    const timeSinceLastSummon = Math.floor((Date.now() - (e.lastAttack || 0)) / 1000);
                    if (timeSinceLastSummon >= 12) {
                        e.summonState = 2; // Cast
                        e.timer = (e.timer || 0) + 1;
                        e.pulsePhase = (e.pulsePhase + 0.3) % (Math.PI * 2);
                        vx = 0; vy = 0;
                        if (e.timer >= 180) {
                            const toSpawn = Math.min(3, maxMinions - myMinions.length);
                            for (let i = 0; i < toSpawn; i++) {
                                spawnMinion(state, e, !!e.isElite);
                            }
                            e.lastAttack = Date.now();
                            e.timer = 0;
                            e.summonState = 0;
                        }
                    }
                }

                // 2. Launch Trigger Logic (Resets when clear)
                const inRange = dist < 400;
                if (dist > 410) e.triggeredLaunchTime = undefined;

                // Only trigger if minions exist (they need to see the entry)
                if (inRange && myMinions.some(m => m.minionState === 0)) {
                    if (e.triggeredLaunchTime === undefined) {
                        e.triggeredLaunchTime = state.gameTime;
                        e.angryUntil = Date.now() + 2000;
                        e.originalPalette = [...e.palette];
                    }
                }

                // 3. Execution of Launch
                if (e.triggeredLaunchTime !== undefined) {
                    // Proximity: Staggered 0.3s launch for ALL
                    const elapsed = state.gameTime - e.triggeredLaunchTime;
                    myMinions.forEach((m, idx) => {
                        if (m.minionState === 0 && elapsed > idx * 0.3) {
                            m.minionState = 1;
                            m.spawnedAt = state.gameTime;
                        }
                    });
                } else if (motherAge >= 60) {
                    // Enrage: Slow 3s launch for ONE
                    if (!e.lastLaunchTime || state.gameTime - e.lastLaunchTime >= 3.0) {
                        const nextMinion = myMinions.find(m => m.minionState === 0);
                        if (nextMinion) {
                            nextMinion.minionState = 1;
                            nextMinion.spawnedAt = state.gameTime;
                            e.lastLaunchTime = state.gameTime;
                        }
                    }
                }

                // Apply Red Flash if angry
                if (e.angryUntil && Date.now() < e.angryUntil) {
                    e.palette = ['#FF4444', '#990000', '#660000'];
                } else if (e.originalPalette && motherAge < 60) {
                    e.palette = e.originalPalette;
                }

                // 4. Mother Movement & Suicide
                if (motherAge < 60) {
                    const angleToPlayerP = Math.atan2(dy, dx);
                    if (dist < 700) {
                        vx = -Math.cos(angleToPlayerP) * currentSpd;
                        vy = -Math.sin(angleToPlayerP) * currentSpd;
                    } else if (dist > 900) {
                        vx = Math.cos(angleToPlayerP) * currentSpd;
                        vy = Math.sin(angleToPlayerP) * currentSpd;
                    } else {
                        vx = Math.cos(angleToPlayerP + Math.PI / 2) * currentSpd * 0.5;
                        vy = Math.sin(angleToPlayerP + Math.PI / 2) * currentSpd * 0.5;
                    }
                } else {
                    // Enraged/Suicide Phase: Stop moving completely
                    vx = 0; vy = 0;
                    e.palette = ['#FF4444', '#990000', '#660000'];

                    // Force red pulse during enrage
                    e.pulsePhase = (e.pulsePhase || 0) + 0.2;

                    if (myMinions.length === 0) {
                        if (e.suicideTimer === undefined) {
                            e.suicideTimer = state.gameTime;
                            playSfx('warning'); // Pre-explosion warning
                        }

                        const timeInSuicide = state.gameTime - e.suicideTimer;

                        // Increasing pulse frequency
                        e.pulsePhase = (e.pulsePhase || 0) + (0.1 + timeInSuicide * 0.1);

                        if (timeInSuicide >= 5.0) {
                            // Explosion Damage to Player
                            const explosionRadius = e.size * 2.0; // 200% of body size
                            if (dist < explosionRadius) {
                                const rawExpDmg = e.maxHp * 0.30; // 30% of Mother HP
                                const armor = calcStat(player.arm);
                                const finalExpDmg = Math.max(0, rawExpDmg - armor);
                                player.curHp -= finalExpDmg;
                                player.damageTaken += finalExpDmg;
                                if (onEvent) onEvent('player_hit', { dmg: finalExpDmg });
                            }

                            e.hp = -100; // Trigger death
                            e.dead = true;
                            playSfx('boss-fire'); // Use a heavy impact sound
                            // High-impact fragmentation effect
                            spawnParticles(state, e.x, e.y, ['#FF0000', '#FF9900', '#FFFFFF'], 50, 4, 60, 'shard');
                        }
                    }
                }
                break;

            case 'minion':
                const mother = state.enemies.find(p => p.id === e.parentId);
                const isOrphan = !mother || mother.dead;

                if (isOrphan) e.minionState = 1;

                if (e.minionState === 0 && mother) {
                    // MODE: LEGIONNAIRE FORMATION (Guarding in front of mother)
                    const angleToPlayer = Math.atan2(player.y - mother.y, player.x - mother.x);
                    const myMinionsActive = state.enemies.filter(m => m.parentId === mother.id && m.minionState === 0 && !m.dead);
                    const myIndex = myMinionsActive.indexOf(e);

                    // PIG'S HEAD (Wedge/Arrow) Formation
                    const baseDist = 180; // Slightly closer to mother
                    const spacingX = 28; // Reduced from 45
                    const spacingY = 32; // Reduced from 50

                    const row = Math.floor((myIndex + 1) / 2);
                    const side = (myIndex === 0) ? 0 : (myIndex % 2 === 1 ? -1 : 1);

                    // Local coordinates relative to mother (local X is "forward" towards player)
                    const localX = baseDist - (row * spacingX);
                    const localY = side * (row * spacingY);

                    // Rotate and translate to world space
                    const cosA = Math.cos(angleToPlayer);
                    const sinA = Math.sin(angleToPlayer);
                    const tx = mother.x + (localX * cosA - localY * sinA);
                    const ty = mother.y + (localX * sinA + localY * cosA);

                    vx = (tx - e.x) * 0.15;
                    vy = (ty - e.y) * 0.15;

                    // ALWAYS LOOK AT PLAYER
                    e.rotationPhase = Math.atan2(player.y - e.y, player.x - e.x);
                } else {
                    // MODE: ROCKET ATTACK
                    const lifeTimeAttack = state.gameTime - (e.spawnedAt || 0);
                    const targetAngle = Math.atan2(dy, dx);

                    const currentMoveAngle = Math.atan2(vy || dy, vx || dx);
                    let diff = targetAngle - currentMoveAngle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;

                    const steeringStr = 0.08;
                    const baseAngle = currentMoveAngle + diff * steeringStr;

                    const snakeFreq = 8;
                    const snakeAmp = 0.4;
                    const snakeAngle = baseAngle + Math.sin(lifeTimeAttack * snakeFreq) * snakeAmp;

                    const rocketSpd = 6.0;
                    vx = Math.cos(snakeAngle) * rocketSpd;
                    vy = Math.sin(snakeAngle) * rocketSpd;

                    e.rotationPhase = snakeAngle;
                }
                break;
            case 'snitch':
                // PER-PHASE TIMEOUT: 30 Seconds
                const timeInPhase = state.gameTime - (e.rareTimer || e.spawnedAt || 0);
                if (timeInPhase > 30) {
                    e.dead = true;
                    state.rareSpawnActive = false;
                    playSfx('rare-despawn');
                    return;
                }

                if (e.rarePhase === 0) {
                    // PHASE 1: STEALTH STALKING (YELLOW)
                    const targetSpd = player.speed * 0.8; // 0.8x player (was 0.3)
                    e.spd = targetSpd;

                    // Drift around player
                    if (e.spiralAngle === undefined) e.spiralAngle = Math.atan2(e.y - player.y, e.x - player.x);
                    e.spiralAngle += 0.005; // slow drift

                    const orbitDist = 1100;
                    let tx = player.x + Math.cos(e.spiralAngle) * orbitDist;
                    let ty = player.y + Math.sin(e.spiralAngle) * orbitDist;

                    // GLOBAL 600px WALL BUFFER - Orbit Safety
                    const wallBuffer = 600;
                    for (let i = 0; i < 5; i++) {
                        // Check if the actual orbit point OR the path to it is too close to void
                        if (!isInMap(tx + Math.cos(e.spiralAngle) * wallBuffer, ty + Math.sin(e.spiralAngle) * wallBuffer) || !isInMap(tx, ty)) {
                            tx -= (tx - player.x) * 0.2;
                            ty -= (ty - player.y) * 0.2;
                        } else {
                            break;
                        }
                    }

                    const tdx = tx - e.x;
                    const tdy = ty - e.y;
                    const tdist = Math.hypot(tdx, tdy);

                    if (tdist > 1) {
                        vx = (tdx / tdist) * e.spd;
                        vy = (tdy / tdist) * e.spd;
                    } else {
                        vx = 0; vy = 0;
                    }

                    // REVEAL TRIGGER: Pure Proximity (< 500px)
                    if (dist < 500) {
                        // TRIGGER PHASE 2
                        console.log(`[SNITCH_DEBUG] Phase 1->2 Trigger! Dist: ${dist}, Pos: (${e.x.toFixed(0)}, ${e.y.toFixed(0)})`);
                        e.rarePhase = 1;
                        e.rareTimer = state.gameTime; // RESET TIMER
                        e.palette = ['#f97316', '#ea580c', '#c2410c']; // Orange shift
                        e.longTrail = []; // Clear trail


                        playSfx('smoke-puff');
                        e.hideCd = 0; // Allow immediate hiding

                        vx = 0; vy = 0;
                        playSfx('rare-spawn'); // Re-ping for activation
                    }

                    if (!e.longTrail) e.longTrail = [];
                    e.longTrail.push({ x: e.x, y: e.y });
                    if (e.longTrail.length > 1000) e.longTrail.shift();

                } else {
                    // PHASE 2: QUANTUM DISPLACEMENT (Elusive & Frustrating)
                    // Goal: Avoid being caught at all costs.
                    // The tether kills enemies it touches.
                    // If enemies die to tether, Snitch charges up and explodes.

                    const time = state.gameTime;
                    const distToPlayer = Math.hypot(player.x - e.x, player.y - e.y);

                    // --- 1. MOVEMENT: WAYPOINT STALKING (No Jitter) ---
                    // Decoupled from frame-by-frame player movement to ensure smoothness.
                    // Snitch picks a spot, goes there, then picks another.

                    // Initialize or Refresh Waypoint
                    if (e.lockedTargetX === undefined || e.lockedTargetY === undefined ||
                        (Math.abs(e.x - e.lockedTargetX) < 50 && Math.abs(e.y - e.lockedTargetY) < 50) ||
                        (e.timer && Date.now() > e.timer)) {

                        // Pick new waypoint
                        // Strategy: Flank - pick a point ~600px from player at random angle
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 500 + Math.random() * 300;

                        let tx = player.x + Math.cos(angle) * dist;
                        let ty = player.y + Math.sin(angle) * dist;

                        // Bounds check
                        if (!isInMap(tx, ty)) {
                            // If invalid, just pick random in arena
                            const center = ARENA_CENTERS[0]; // fallback
                            tx = center.x + (Math.random() - 0.5) * 500;
                            ty = center.y + (Math.random() - 0.5) * 500;
                        }

                        e.lockedTargetX = tx;
                        e.lockedTargetY = ty;
                        e.timer = Date.now() + 3000; // 3s max to reach point
                    }

                    // MOVEMENT EXECUTION
                    // Smooth steering towards waypoint
                    const dx = e.lockedTargetX - e.x;
                    const dy = e.lockedTargetY - e.y;
                    const d = Math.hypot(dx, dy);

                    if (d > 1) {
                        // Steer
                        vx = (dx / d) * e.spd;
                        vy = (dy / d) * e.spd;
                    } else {
                        vx = 0; vy = 0;
                    }

                    // EMERGENCY OVERRIDE: Too close to player?
                    // Only react if VERY close (< 250), otherwise ignore to prevent jitter
                    if (distToPlayer < 250) {
                        const angAway = Math.atan2(e.y - player.y, e.x - player.x);
                        vx = Math.cos(angAway) * e.spd * 2.0;
                        vy = Math.sin(angAway) * e.spd * 2.0;
                        // Force new waypoint next frame
                        e.lockedTargetX = undefined;
                    }





                    // --- 2. SUBSTITUTION JUTSU (Swap with Enemy) ---
                    // Trigger: Player dangerously close (< 350px)
                    if (distToPlayer < 350 && (!e.tacticalTimer || time > e.tacticalTimer)) {
                        // Find swap target (nearest enemy outside of immediate danger radius)
                        // Ideally somewhat far from player but within Snitch's range
                        let bestTarget: Enemy | null = null;
                        let maxDist = 0;

                        for (const other of state.enemies) {
                            if (other === e || other.dead || other.boss || other.shape === 'snitch') continue;

                            const dToP = Math.hypot(other.x - player.x, other.y - player.y);
                            const dToS = Math.hypot(other.x - e.x, other.y - e.y);

                            // Criteria:
                            // 1. Target must be further from player than Snitch is (dToP > distToPlayer)
                            // 2. Target must be within swap range of Snitch (e.g. < 800px)
                            if (dToP > distToPlayer + 200 && dToS < 800) {
                                if (dToP > maxDist) {
                                    maxDist = dToP;
                                    bestTarget = other;
                                }
                            }
                        }

                        if (bestTarget) {
                            // EXECUTE SWAP
                            const oldX = e.x; const oldY = e.y;
                            const newX = bestTarget.x; const newY = bestTarget.y;

                            // Move Snitch
                            e.x = newX; e.y = newY;
                            // Move Target (Substitution)
                            bestTarget.x = oldX; bestTarget.y = oldY;

                            // FX: Smoke puffs at both locations
                            spawnParticles(state, oldX, oldY, ['#F0F0F0', '#808080'], 20, 50, 60); // At old snitch pos
                            spawnParticles(state, newX, newY, ['#F0F0F0', '#808080'], 20, 50, 60); // At new snitch pos

                            // Flash effects
                            playSfx('smoke-puff'); // "Poof" sound

                            e.tacticalTimer = time + 4.0; // 4s Cooldown

                            // Brief speed boost after swap
                            e.panicCooldown = time + 1.0;
                        }
                    }



                    // Apply Panic Speed Boost (from swap)
                    if (e.panicCooldown && time < e.panicCooldown) {
                        vx *= 2.0;
                        vy *= 2.0;
                    }

                    // Wall Avoidance
                    const nextX = e.x + vx;
                    const nextY = e.y + vy;
                    if (!isInMap(nextX, nextY)) {
                        vx = -vx;
                        vy = -vy;
                    }


                }
                break; // End snitch case
        }

        // --- GLOBAL PER-ENEMY LOGIC (Applies after switch behaviors) ---
        // (Existing Jitter/Wall logic follows naturally now)
        // Jitter
        e.x += (Math.random() - 0.5) * 1;
        e.y += (Math.random() - 0.5) * 1;

        // --- WALL COLLISION CHECK ---
        const nextX = e.x + vx;
        const nextY = e.y + vy;

        if (isInMap(nextX, nextY)) {
            e.x = nextX;
            e.y = nextY;
        } else {
            // REAL SNITCH IMMUNITY
            if (e.shape === 'snitch' && e.rareReal) {
                const nearestCenterPos = ARENA_CENTERS.reduce((best, center) => {
                    const distToCenter = Math.hypot(e.x - center.x, e.y - center.y);
                    return distToCenter < Math.hypot(e.x - best.x, e.y - best.y) ? center : best;
                }, ARENA_CENTERS[0]);
                const angToCenter = Math.atan2(nearestCenterPos.y - e.y, nearestCenterPos.x - e.x);
                e.x += Math.cos(angToCenter) * 50;
                e.y += Math.sin(angToCenter) * 50;
            } else {
                // Hit Wall - INSTANT DEATH
                e.dead = true;
                e.hp = 0;
                state.killCount++;
                state.score += 1;
                spawnParticles(state, e.x, e.y, e.palette[0], 20);

                if (e.isRare && e.rareReal) {
                    playSfx('rare-kill');
                    state.rareRewardActive = true;
                    state.rareSpawnActive = false;
                    state.player.xp.current += state.player.xp.needed;
                } else {
                    let xpGain = state.player.xp_per_kill.base;
                    if (e.xpRewardMult !== undefined) xpGain *= e.xpRewardMult;
                    else if (e.isElite) xpGain *= 12;
                    state.player.xp.current += xpGain;
                }

                while (state.player.xp.current >= state.player.xp.needed) {
                    state.player.xp.current -= state.player.xp.needed;
                    state.player.level++;
                    state.player.xp.needed *= 1.10;
                    if (onEvent) onEvent('level_up');
                }
                return;
            }
        }

        // Visual Updates
        if (e.shape !== 'pentagon' || e.summonState === 2) {
            const pulseSpeed = (Math.PI * 2) / pulseDef.interval;
            e.pulsePhase = (e.pulsePhase + pulseSpeed) % (Math.PI * 2);
        }
        e.rotationPhase = (e.rotationPhase || 0) + 0.01;

        if (e.hp <= 0 && !e.dead) {
            e.dead = true;
        }
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

    const rareEnemy: Enemy = {
        id: Math.random(),
        type: 'square', x, y,
        hp: 1, maxHp: 3, spd: player.speed * 0.8, // 0.8x player speed
        boss: false, bossType: 0, bossAttackPattern: 0, lastAttack: 0, dead: false,
        shape: 'snitch', shellStage: 2, palette: ['#FACC15', '#EAB308', '#CA8A04'],
        pulsePhase: 0, rotationPhase: 0, timer: Date.now(),
        isRare: true, size: 18, rarePhase: 0, rareTimer: state.gameTime, rareIntent: 0, rareReal: true, canBlock: false,
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
function spawnMinion(state: GameState, parent: Enemy, isStrong: boolean = false) {
    // Normal Minion: 5% of Mother HP
    // Strong Minion: 10% of Mother HP
    const hpRatio = isStrong ? 0.10 : 0.05;
    const minionHp = parent.maxHp * hpRatio;

    // XP: 15% of Mother's XP
    const motherMult = parent.xpRewardMult || (parent.isElite ? 12 : 1);
    const minionXpMult = motherMult * 0.15;

    const newMinion: Enemy = {
        id: Math.random(),
        type: 'minion',
        x: parent.x, y: parent.y,
        size: 12,
        hp: minionHp,
        maxHp: minionHp,
        spd: 5.5, // Rocket speed
        boss: false, bossType: 0, bossAttackPattern: 0, lastAttack: 0, dead: false,
        shape: 'minion',
        shellStage: 0,
        palette: parent.palette,
        pulsePhase: 0,
        rotationPhase: Math.random() * 6.28,
        spawnedAt: state.gameTime,
        knockback: { x: 0, y: 0 },
        isRare: false,

        // Guard behavior
        parentId: parent.id,
        minionState: 0, // Orbit
        orbitAngle: Math.random() * Math.PI * 2,
        orbitDistance: 160 + Math.random() * 80,

        // Custom Stats
        stunOnHit: isStrong,
        xpRewardMult: minionXpMult,
        customCollisionDmg: isStrong ? (parent.maxHp * 0.03) : (parent.maxHp * 0.15)
    };
    state.enemies.push(newMinion);
}

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

        // Check merge cooldown
        if (e.mergeCooldown && state.gameTime < e.mergeCooldown) continue;

        // Query neighbors in 100px radius (50% reduction)
        const neighbors = spatialGrid.query(e.x, e.y, 100);

        // Filter: Same shape, not merging, not elite, not boss, not on cooldown, not neutral
        const candidates = neighbors.filter(n =>
            n.shape === e.shape &&
            !n.dead && !n.boss && !n.isElite && !n.isRare && !n.mergeState && !n.isNeutral &&
            n.shape !== 'minion' && // Fix: Minions (Summoners) cannot merge
            (!n.mergeCooldown || state.gameTime >= n.mergeCooldown)
        );

        const threshold = e.shape === 'pentagon' ? 5 : 10;

        if (candidates.length >= threshold) {
            // FOUND CLUSTER!
            const cluster = candidates.slice(0, threshold);
            const mergeId = `merge_${Math.random()}`;

            cluster.forEach((c, index) => {
                c.mergeState = 'warming_up';
                c.mergeId = mergeId;
                c.mergeTimer = state.gameTime + 3; // 3 seconds from now
                c.mergeHost = index === 0;
                c.mergeCooldown = undefined; // Clear cooldown when joining new merge
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
        if (e.mergeState === 'warming_up' && e.mergeId && !e.dead) { // Only include alive enemies
            if (!mergeGroups.has(e.mergeId)) mergeGroups.set(e.mergeId, []);
            mergeGroups.get(e.mergeId)!.push(e);
        }
    });

    mergeGroups.forEach((group, mergeId) => {
        // Filter out dead enemies
        const aliveEnemies = group.filter(e => !e.dead && e.hp > 0);

        // Determine threshold based on shape of first member
        const sample = group[0];
        const threshold = (sample && sample.shape === 'pentagon') ? 5 : 10;

        if (aliveEnemies.length < threshold) {
            // Try to recruit new enemies to replace dead ones
            const firstAlive = aliveEnemies[0];
            if (firstAlive) {
                const nearby = state.spatialGrid.query(firstAlive.x, firstAlive.y, 100);
                const recruits = nearby.filter(n =>
                    n.shape === firstAlive.shape &&
                    !n.dead && !n.boss && !n.isElite && !n.isRare && !n.mergeState
                ).slice(0, threshold - aliveEnemies.length);

                // Add recruits to merge
                recruits.forEach((r) => {
                    r.mergeState = 'warming_up';
                    r.mergeId = mergeId;
                    r.mergeTimer = firstAlive.mergeTimer; // Same timer
                    r.mergeHost = false; // New recruits aren't host
                    r.mergeCooldown = undefined; // Clear cooldown when joining merge
                });

                // Update alive count
                aliveEnemies.push(...recruits);
            }

            // If still not enough after recruitment, cancel
            if (aliveEnemies.length < threshold) {
                group.forEach(e => {
                    e.mergeState = 'none';
                    e.mergeTimer = 0;
                    e.mergeId = undefined;
                    e.mergeHost = false;
                    e.mergeCooldown = state.gameTime + 2; // 2s cooldown before trying again
                });
                return;
            }
        }

        const first = aliveEnemies[0];
        if (state.gameTime >= (first.mergeTimer || 0)) {
            // SUCCESS
            const host = aliveEnemies.find(e => e.mergeHost); // Use alive enemies only
            if (!host) return;

            // Upgrade Host
            host.mergeState = 'none';
            host.isElite = true;
            host.eliteState = 0;
            host.spawnedAt = state.gameTime; // Reset age for Elites
            host.lastAttack = Date.now() + 3000; // 15s Cooldown for first spawn (12s base + 3s offset)
            host.size *= 1.2; // Significantly reduced scale from 2.5 (Reduce by "200%" relative to growth)

            // Stats Multiplier: 12x for standard (10 merge), 6x for Pentagon (5 merge)
            const mult = host.shape === 'pentagon' ? 6 : 12;
            host.hp *= mult;
            host.maxHp *= mult;
            host.hp = host.maxHp;

            // Set XP Multiplier
            host.xpRewardMult = mult;

            // Despawn others (only from alive enemies)
            aliveEnemies.forEach(e => {
                if (e !== host) {
                    e.dead = true;
                    e.hp = 0;
                }
            });

            playSfx('merge-complete');
        }
    });
}
