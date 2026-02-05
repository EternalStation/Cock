import type { GameState, Enemy } from './types';
import { isInMap, ARENA_CENTERS, getHexDistToWall } from './MapLogic';
import { playSfx } from './AudioLogic';
import { spawnParticles, spawnFloatingNumber } from './ParticleLogic';
import { handleEnemyDeath } from './DeathLogic';
import { getPlayerThemeColor } from './helpers';

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
    if (state.activeEvent?.type === 'legion_formation') actualRate *= 2.0; // Double spawn rate to feed legions

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

    // --- LEGION CACHING (Optimization) ---
    const legionGroups = new Map<string, { lead: Enemy | null, members: Enemy[] }>();
    state.legionLeads = {}; // Global cache for this frame
    enemies.forEach(e => {
        if (e.legionId && !e.dead) {
            if (!legionGroups.has(e.legionId)) {
                legionGroups.set(e.legionId, { lead: null, members: [] });
            }
            const group = legionGroups.get(e.legionId)!;
            group.members.push(e);
            if (e.id === e.legionLeadId) {
                group.lead = e;
                state.legionLeads![e.legionId] = e;
            }
        }
    });

    // Handle lead reassignment for broken legions
    legionGroups.forEach((group, legionId) => {
        if (!group.lead && group.members.length > 0) {
            const newLead = group.members[0];
            group.lead = newLead;
            group.members.forEach(m => m.legionLeadId = newLead.id);
            state.legionLeads![legionId] = newLead;
        }
    });

    const activeLegionIds = Array.from(legionGroups.keys());

    // --- LEGION FORMATION (Optimization: O(N)) ---
    if (state.activeEvent?.type === 'legion_formation' && state.frameCount % 60 === 0) {
        const candidatesByShape = new Map<string, Enemy[]>();
        enemies.forEach(e => {
            if (!e.dead && !e.isElite && !e.boss && !e.isZombie && !e.isRare && !e.legionId && !e.wasInLegion) {
                if (!candidatesByShape.has(e.shape)) candidatesByShape.set(e.shape, []);
                candidatesByShape.get(e.shape)!.push(e);
            }
        });

        candidatesByShape.forEach((available, shape) => {
            while (available.length >= 30) {
                const legionId = `legion_${Math.random()}`;
                const members = available.splice(0, 30);

                let totalHp = 0;
                members.forEach(m => totalHp += m.hp);
                // User Request: 200% Shield initially (was 50%)
                const sharedShield = totalHp * 2.0;

                members.forEach((m, idx) => {
                    m.legionId = legionId;
                    m.wasInLegion = true;
                    m.legionLeadId = members[0].id;
                    m.mergeState = undefined;
                    m.mergeId = undefined;
                    m.mergeTimer = undefined;
                    m.mergeHost = undefined;
                    m.legionSlot = { x: idx % 6, y: Math.floor(idx / 6) };
                    m.legionShield = sharedShield;
                    m.maxLegionShield = sharedShield;
                });

                // Add to our frame cache immediately
                legionGroups.set(legionId, { lead: members[0], members });
                state.legionLeads![legionId] = members[0];
                activeLegionIds.push(legionId);

                console.log(`Legion formed! ${shape} formation with ${sharedShield} shield.`);
            }
        });
    }

    // --- MERGING LOGIC ---
    // User: No merges until at least one legion is still alive
    const anyLegionAlive = activeLegionIds.length > 0;

    // Clear merge groups if any member is in a legion
    const compromisedMergeIds = new Set<string>();
    enemies.forEach(e => {
        if (e.legionId && e.mergeId) compromisedMergeIds.add(e.mergeId);
    });

    if (compromisedMergeIds.size > 0) {
        enemies.forEach(e => {
            if (e.mergeId && compromisedMergeIds.has(e.mergeId)) {
                e.mergeState = undefined;
                e.mergeId = undefined;
                e.mergeTimer = undefined;
                e.mergeHost = undefined;
            }
        });
    }

    if (state.activeEvent?.type !== 'legion_formation' && !anyLegionAlive) {
        // 1. Manage Active Clusters
        manageMerges(state);

        // 2. Scan for new clusters (Throttled)
        if (Math.floor(state.gameTime * 60) % 30 === 0) { // Check every 0.5s
            scanForMerges(state);
        }
    }

    enemies.forEach(e => {
        if (e.dead) return;

        // Sync visual progression to current game time
        const params = getProgressionParams(gameTime);
        e.fluxState = params.fluxState;

        if (!e.isNeutral && !e.isRare && !e.isNecroticZombie) {
            e.eraPalette = params.eraPalette.colors;
        }

        // Particle Leakage (Starts at 30m, increases at 60m)
        const minutes = gameTime / 60;
        if (minutes > 30 && !e.isNeutral) {
            const chance = minutes > 60 ? 10 : 30; // Every 10 or 30 frames
            if (state.frameCount % chance === 0) {
                spawnParticles(state, e.x, e.y, e.eraPalette?.[0] || e.palette[0], 1, 15, 0, 'void');
            }
        }

        // --- ZOMBIE LOGIC ---
        if (e.isZombie) {
            updateZombie(e, state, step, onEvent);
            return;
        }

        if (e.frozen && e.frozen > 0) {
            e.frozen -= 1 / 60;
            return;
        }

        // Reset Frame-based Multipliers (but not for bosses - they manage their own)
        if (!e.boss) {
            e.takenDamageMultiplier = 1.0;
        }

        // --- CLASS MODIFIER: Hive-Mother Nanite DOT ---
        if (e.isInfected) {
            const dotFreq = 30; // Every 30 frames (2 times per second at 60fps)
            if (state.frameCount % dotFreq === 0) {
                const dmgPerTick = (e.infectionDmg || 0) / 2; // Split damage over 2 ticks per second
                if (dmgPerTick > 0) {
                    // Accumulate damage to handle sub-integer values correctly
                    e.infectionAccumulator = (e.infectionAccumulator || 0) + dmgPerTick;

                    if (e.infectionAccumulator >= 1) {
                        const actualDmg = Math.floor(e.infectionAccumulator);
                        if (actualDmg > 0) { // Only show if damage is actually dealt
                            e.hp -= actualDmg;
                            player.damageDealt += actualDmg;
                            e.infectionAccumulator -= actualDmg;

                            const themeColor = getPlayerThemeColor(state);
                            spawnFloatingNumber(state, e.x, e.y, actualDmg.toString(), themeColor, false);
                            spawnParticles(state, e.x, e.y, themeColor, 1); // Reduced count for higher frequency
                        }
                    }
                }
            }
        }

        // Wall collision - Bosses survive with 10% Max HP penalty
        if (!isInMap(e.x, e.y)) {
            if (e.boss) {
                const now = state.gameTime;
                if (!e.lastWallHit || now - e.lastWallHit > 1.0) {
                    const wallDmg = e.maxHp * 0.1;
                    e.hp -= wallDmg;
                    spawnFloatingNumber(state, e.x, e.y, Math.round(wallDmg).toString(), '#ef4444', true);
                    spawnParticles(state, e.x, e.y, e.eraPalette?.[0] || e.palette[0], 10);
                    playSfx('impact');
                    e.lastWallHit = now;

                    const { dist, normal } = getHexDistToWall(e.x, e.y);
                    // Strong bounce back (150px away from wall to clear boundary definitively)
                    e.x += normal.x * (Math.abs(dist) + 150);
                    e.y += normal.y * (Math.abs(dist) + 150);

                    // Add lingering knockback velocity
                    e.knockback.x = normal.x * 20;
                    e.knockback.y = normal.y * 20;
                }

                if (e.hp <= 0 && !e.dead) {
                    handleEnemyDeath(state, e, onEvent);
                    return;
                }
            } else {
                e.dead = true;
                e.hp = 0;
                spawnParticles(state, e.x, e.y, e.eraPalette?.[0] || e.palette[0], 20);
                return;
            }
        }

        // Knockback handling - Decay faster for snappier boss bounces
        if (e.knockback && (e.knockback.x !== 0 || e.knockback.y !== 0)) {
            e.x += e.knockback.x;
            e.y += e.knockback.y;
            e.knockback.x *= 0.7; // Snappier decay
            e.knockback.y *= 0.7;
            if (Math.abs(e.knockback.x) < 0.1) e.knockback.x = 0;
            if (Math.abs(e.knockback.y) < 0.1) e.knockback.y = 0;
            // DO NOT RETURN - let boss/enemy AI continue to process
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
                            // User: Legion members are like walls, push others strongly
                            let multiplier = 0.01;
                            if (other.legionId) multiplier = 0.8; // Harder wall-like push

                            pushX += (odx / odist) * pushDist * multiplier;
                            pushY += (ody / odist) * pushDist * multiplier;
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
        } else if ((e.type as string) === 'orbital_shield') {
            // --- ORBITAL SHIELD LOGIC ---
            if (e.parentId) {
                const parent = state.enemies.find(p => p.id === e.parentId);
                if (!parent || parent.dead) {
                    e.dead = true;
                    e.hp = 0;
                } else {
                    // Orbit Logic
                    const orbitSpeed = 0.01; // Slower orbit (3x slower)
                    const orbitDist = 150; // Increased to properly cover boss (boss size is 60)
                    e.rotationPhase = (e.rotationPhase || 0) + orbitSpeed;

                    // Assign position directly (lock to parent)
                    // We also add the index offset to space them out? 
                    // No, usually we spawn them with different phases. 
                    // spawnShield sets random phase, but Boss spawns them with specific angles.
                    // We should let rotationPhase drive the position.

                    // Recalculate position based on Parent + Phase
                    // Note: BossSpawnLogic sets initial pos, but here we override it to orbit.
                    const targetX = parent.x + Math.cos(e.rotationPhase) * orbitDist;
                    const targetY = parent.y + Math.sin(e.rotationPhase) * orbitDist;

                    // Direct set or smooth move? Direct set is better for rigid shield feel.
                    e.x = targetX;
                    e.y = targetY;
                    v = { vx: 0, vy: 0 }; // No independent velocity
                }
            } else {
                e.dead = true; // Orphaned shield
            }
        } else if (e.boss) {
            v = updateBossEnemy(e, currentSpd, dx, dy, pushX, pushY, state, onEvent);
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
                case 'circle': v = updateNormalCircle(e, dx, dy, currentSpd, pushX, pushY); break;
                case 'triangle': v = updateNormalTriangle(e, dx, dy, pushX, pushY); break;
                case 'square': v = updateNormalSquare(currentSpd, dx, dy, pushX, pushY); break;
                case 'diamond': v = updateNormalDiamond(e, state, dist, dx, dy, currentSpd, pushX, pushY); break;
                case 'pentagon': v = updateNormalPentagon(e, state, dist, dx, dy, currentSpd, pushX, pushY); break;
            }
        }

        let vx = v.vx;
        let vy = v.vy;



        // 2. Behavior (Persists after event ends)
        if (e.legionId && e.legionSlot && e.legionLeadId) {
            const group = legionGroups.get(e.legionId);
            const lead = group?.lead;
            const members = group?.members || [];

            if (lead && members.length > 0) {
                // Legion members ignore fear/fleeing
                e.fearedUntil = 0;

                // Sync lead's shield to this member for projectile logic (which hits member)
                e.legionShield = lead.legionShield;
                e.maxLegionShield = lead.maxLegionShield;

                // Legion Center Target
                const spacing = e.size * 2.5;

                // The legion moves as a unit towards the player
                const legionSpd = currentSpd * 1.2; // User: Increased speed towards player

                // Actually, let's just make them move towards their slot relative to the legion's "lead"
                // (lead already defined above)

                const targetX = lead.x + (e.legionSlot.x * spacing);
                const targetY = lead.y + (e.legionSlot.y * spacing);

                const tdx = targetX - e.x;
                const tdy = targetY - e.y;
                const tdist = Math.hypot(tdx, tdy);

                if (tdist > 5) {
                    const catchUpSpd = currentSpd * 2;
                    vx = (tdx / tdist) * Math.min(catchUpSpd, tdist);
                    vy = (tdy / tdist) * Math.min(catchUpSpd, tdist);
                } else if (e === lead) {
                    // Lead moves towards player (Coordinated with other legions for a side-by-side line)
                    const myLegionIndex = activeLegionIds.indexOf(e.legionId);
                    const totalLegions = activeLegionIds.length;

                    // Direction to player
                    const globalAngle = Math.atan2(player.y - e.y, player.x - e.x);
                    const perpAngle = globalAngle + Math.PI / 2;

                    const spacing = e.size * 2.5;
                    const gridWidth = 6 * spacing;
                    const offsetMultiplier = myLegionIndex - (totalLegions - 1) / 2;
                    const sideShift = offsetMultiplier * (gridWidth + 100); // 100px gap between legions

                    // Final Phalanx Target Point (where the "center" or player is)
                    const phalanxTargetX = player.x + Math.cos(perpAngle) * sideShift;
                    const phalanxTargetY = player.y + Math.sin(perpAngle) * sideShift;

                    // NEW: Targeting - move formation so the closest member touches the phalanxTarget
                    let closestMember = members[0];
                    let minDist = Infinity;
                    members.forEach(m => {
                        const d = Math.hypot(m.x - phalanxTargetX, m.y - phalanxTargetY);
                        if (d < minDist) {
                            minDist = d;
                            closestMember = m;
                        }
                    });

                    // Offset from lead to the closest member
                    const memberOffX = closestMember.legionSlot!.x * spacing;
                    const memberOffY = closestMember.legionSlot!.y * spacing;

                    // Lead's goal is to put that member on the target
                    const finalTargetX = phalanxTargetX - memberOffX;
                    const finalTargetY = phalanxTargetY - memberOffY;

                    const ldx = finalTargetX - e.x;
                    const ldy = finalTargetY - e.y;
                    const ldist = Math.hypot(ldx, ldy);

                    if (ldist > 10) {
                        vx = (ldx / ldist) * legionSpd;
                        vy = (ldy / ldist) * legionSpd;
                    } else {
                        vx = 0;
                        vy = 0;
                    }
                } else {
                    // Match lead's velocity (approx) for tight formation
                    vx = lead.vx || 0;
                    vy = lead.vy || 0;
                }

                // Check Assemblage Status
                // If member is far from target slot, it is "assembling"
                const distToSlot = Math.hypot(e.x - targetX, e.y - targetY);
                // We consider "Assembled" if within small distance
                if (distToSlot > 20) {
                    e.isAssembling = true;
                } else {
                    e.isAssembling = false;
                }

                // Initial State Force: If just formed (e.g. first frame), ensure isAssembling is true to prevent blink
                // The check above should handle it naturally.

                // No personal push when in legion to maintain formation
                pushX = 0;
                pushY = 0;
            } else {
                e.legionId = undefined;
                e.isAssembling = false;
            }
        }

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
            if (e.boss) {
                const now = state.gameTime;
                if (!e.lastWallHit || now - e.lastWallHit > 1.0) {
                    const wallDmg = e.maxHp * 0.1;
                    e.hp -= wallDmg;
                    spawnFloatingNumber(state, e.x, e.y, Math.round(wallDmg).toString(), '#ef4444', true);
                    spawnParticles(state, e.x, e.y, e.eraPalette?.[0] || e.palette[0], 10);
                    playSfx('impact');
                    e.lastWallHit = now;
                }

                const { dist, normal } = getHexDistToWall(e.x, e.y);
                e.x += normal.x * (Math.abs(dist) + 150);
                e.y += normal.y * (Math.abs(dist) + 150);

                // Add lingering knockback velocity
                e.knockback.x = normal.x * 20;
                e.knockback.y = normal.y * 20;

                if (e.hp <= 0 && !e.dead) handleEnemyDeath(state, e, onEvent);
            } else if (e.shape === 'snitch' && e.rareReal) {
                const c = ARENA_CENTERS[0];
                const a = Math.atan2(c.y - e.y, c.x - e.x);
                e.x += Math.cos(a) * 50; e.y += Math.sin(a) * 50;
            } else {
                // User: Legion enemies are invincible until shield is destroyed
                if (e.legionId && e.legionLeadId) {
                    const lead = state.enemies.find(m => m.id === e.legionLeadId && !m.dead);
                    if (lead && (lead.legionShield || 0) > 0) {
                        return;
                    }
                }
                handleEnemyDeath(state, e, onEvent);
                return;
            }
        }

        e.pulsePhase = (e.pulsePhase + (Math.PI * 2) / pulseDef.interval) % (Math.PI * 2);
        e.rotationPhase = (e.rotationPhase || 0) + 0.01;
        if (e.hp <= 0 && !e.dead) handleEnemyDeath(state, e, onEvent);
    });
}

/**
 * Resets the attack states and timers of all elite and boss enemies.
 * This is called when the game is unpaused to prevent immediate hits
 * from telegraphed attacks that were mid-animation.
 */
export function resetEnemyAggro(state: GameState) {
    state.enemies.forEach(e => {
        // Reset Elite States
        if (e.isElite) {
            e.eliteState = 0;
            e.timer = Date.now() + 1000; // Force a delay before stalking again
            e.lastAttack = Date.now();
            e.lockedTargetX = undefined;
            e.lockedTargetY = undefined;
            e.hasHitThisBurst = false;
        }

        // Reset Boss States
        if (e.boss) {
            if (e.shape === 'circle') e.dashState = 0;
            if (e.shape === 'triangle') e.berserkState = false;
            if (e.shape === 'diamond') e.beamState = 0;

            // Shared Boss Timers
            e.dashTimer = 0;
            e.beamTimer = 0;
            e.berserkTimer = 0;
            e.lastAttack = Date.now();
            e.hasHitThisBurst = false;
        }
    });
}


