import { isInMap } from './MapLogic';
import { playSfx } from './AudioLogic';
import { calcStat } from './MathUtils';
import type { GameState } from './types';
import { spawnParticles, spawnFloatingNumber } from './ParticleLogic';
import { getHexMultiplier, getHexLevel, calculateLegendaryBonus } from './LegendaryLogic';
import { handleEnemyDeath } from './DeathLogic';




// Helper: Trigger Shockwave
function triggerShockwave(state: GameState, angle: number, level: number) {
    // Lvl 1: 75% dmg, 450 range (was 2500, then 500)
    // Lvl 3: 125% dmg, 600 range (was 3750, then 750)
    // Lvl 4: Backwards wave too

    const range = level >= 3 ? 600 : 450;
    const damageMult = level >= 3 ? 1.25 : 0.75;
    const coneHalfAngle = 0.7; // ~80 degrees total

    const playerDmg = calcStat(state.player.dmg);
    const waveDmg = playerDmg * damageMult;

    const castWave = (waveAngle: number) => {
        // Visuals: Echolocation Wave (Single clean arc)
        // We use a special 'shockwave' particle type that the renderer draws as a bent line
        const speed = 25; // Even Faster (was 18) to ensure it disappears quickly at destination

        state.particles.push({
            x: state.player.x,
            y: state.player.y,
            vx: Math.cos(waveAngle) * speed,
            vy: Math.sin(waveAngle) * speed,
            life: range / speed, // Live just long enough to reach max range (approx 18-24 frames)
            color: '#38BDF8', // Epic Light Blue
            size: 300, // Larger radius for "flatter" look
            type: 'shockwave',
            alpha: 1.0,
            decay: 0.05
        });

        // Add "Epic" Debris / Energy particles
        for (let k = 0; k < 12; k++) {
            const debrisAngle = waveAngle + (Math.random() - 0.5) * coneHalfAngle;
            const debrisSpeed = speed * (0.9 + Math.random() * 0.2);
            state.particles.push({
                x: state.player.x,
                y: state.player.y,
                vx: Math.cos(debrisAngle) * debrisSpeed,
                vy: Math.sin(debrisAngle) * debrisSpeed,
                life: (range / speed) * (0.8 + Math.random() * 0.2), // Die with wave
                color: Math.random() > 0.5 ? '#BAE6FD' : '#60A5FA', // Mix of blues
                size: 2 + Math.random() * 4,
                type: 'spark',
                alpha: 1.0,
                decay: 0.1 // Faster decay
            });
        }

        playSfx('sonic-wave');

        // Damage Logic (Instant Hitscan for gameplay feel, visualization catches up)
        state.enemies.forEach(e => {
            if (e.dead || e.isFriendly || e.isZombie) return;
            const dx = e.x - state.player.x;
            const dy = e.y - state.player.y;
            const dist = Math.hypot(dx, dy);

            if (dist < range) {
                const angleToEnemy = Math.atan2(dy, dx);
                const diff = Math.abs(angleToEnemy - waveAngle);
                // Normalized diff
                const normDiff = Math.min(diff, Math.abs(diff - Math.PI * 2));

                if (normDiff < coneHalfAngle) {
                    // Hit!
                    e.hp -= waveDmg;
                    state.player.damageDealt += waveDmg;
                    spawnFloatingNumber(state, e.x, e.y, Math.round(waveDmg).toString(), '#38BDF8', false);
                    // Flash hit effect
                    spawnParticles(state, e.x, e.y, '#EF4444', 3);

                    // Lvl 2: Fear
                    if (level >= 2) {
                        e.fearedUntil = state.gameTime + 1.5; // 1.5s
                    }
                }
            }
        });
    };

    castWave(angle);

    if (level >= 4) {
        castWave(angle + Math.PI);
    }
}

export function spawnBullet(state: GameState, x: number, y: number, angle: number, dmg: number, pierce: number, offsetAngle: number = 0) {
    if (state.player.immobilized) return;
    const spd = 12;

    // --- ComCrit Logic ---
    const critLevel = getHexLevel(state, 'ComCrit');
    let isCrit = false;
    let finalDmg = dmg;
    let mult = 1.0;

    if (critLevel > 0) {
        let chance = 0.15;
        mult = 2.0;
        if (state.moduleSockets.hexagons.some(h => h?.type === 'ComCrit' && h.level >= 4)) {
            chance = 0.25;
            mult = 3.5;
        }

        if (Math.random() < chance) {
            isCrit = true;
            finalDmg *= mult;
        } else {
            mult = 1.0;
        }
    }

    state.bullets.push({
        id: Math.random(),
        x, y,
        vx: Math.cos(angle + offsetAngle) * spd,
        vy: Math.sin(angle + offsetAngle) * spd,
        dmg: finalDmg,
        pierce,
        life: 140, // Frames
        isEnemy: false,
        hits: new Set(),
        size: 4,
        isCrit,
        critMult: mult
    });

    // --- ComWave Logic ---
    const waveLevel = getHexLevel(state, 'ComWave');
    if (waveLevel > 0) {
        state.player.shotsFired = (state.player.shotsFired || 0) + 1;
        if (state.player.shotsFired % 15 === 0) {
            triggerShockwave(state, angle + offsetAngle, waveLevel);
        }
    }
}

export function spawnEnemyBullet(state: GameState, x: number, y: number, angle: number, dmg: number, color: string = '#FF0000') {
    const spd = 6;
    state.enemyBullets.push({
        id: Math.random(),
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        dmg,
        pierce: 1,
        life: 300,
        isEnemy: true,
        hits: new Set(),
        color,
        size: 6
    });
}

export function updateProjectiles(state: GameState, onEvent?: (event: string, data?: any) => void) {
    const { bullets, enemyBullets, player } = state;
    const now = Date.now();

    // --- PLAYER BULLETS ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        // Collision with Map Boundary (Walls)
        if (!isInMap(b.x, b.y)) {
            spawnParticles(state, b.x, b.y, '#22d3ee', 10);
            bullets.splice(i, 1);
            continue;
        }

        let bulletRemoved = false;

        // Collision with Enemies
        const nearbyEnemies = state.spatialGrid.query(b.x, b.y, 100); // 100px search radius (covers max enemy size)

        for (let j = 0; j < nearbyEnemies.length; j++) {
            const e = nearbyEnemies[j];

            // Ignore friendly zombies or dead/immune stuff
            // Friendly zombies shouldn't be hit by player bullets? Usually yes.
            // "on your side".
            if (e.dead || e.hp <= 0 || b.hits.has(e.id) || e.isFriendly || e.isZombie) continue;

            const dist = Math.hypot(e.x - b.x, e.y - b.y);
            const hitRadius = e.size + 10;

            if (dist < hitRadius) {
                // --- ComCrit Lvl 3: Death Mark Amplification ---
                const critLevel = getHexLevel(state, 'ComCrit');
                let damageAmount = b.dmg;

                // Apply Taken Damage Multiplier (e.g. Puddle)
                if (e.takenDamageMultiplier) {
                    damageAmount *= e.takenDamageMultiplier;
                }

                // Check if Marked (Shattered Fate Lvl 3)
                if (critLevel >= 3 && e.deathMarkExpiry && state.gameTime < e.deathMarkExpiry) {
                    const markMult = 3.0;
                    const bulletMult = b.critMult || 1.0;
                    const finalMult = Math.max(bulletMult, markMult);

                    // Priority: Apply the highest multiplier (ensure at least 300% for marked)
                    damageAmount = (b.dmg / bulletMult) * finalMult;

                    spawnParticles(state, e.x, e.y, '#FF0000', 3);
                    e.critGlitchUntil = now + 100; // Set glitch timer (100ms)
                }

                // --- ComLife Lvl 3: +2% Max HP Dmg (Non-Boss) ---
                const lifeLevel = getHexLevel(state, 'ComLife');
                if (lifeLevel >= 3 && !e.boss) {
                    damageAmount += e.maxHp * 0.02;
                }

                // 1. Apply Damage
                e.hp -= damageAmount;
                player.damageDealt += damageAmount;
                b.hits.add(e.id);
                b.pierce--;

                // Determine if crit for visual
                const isCritVisible = !!b.isCrit || (critLevel >= 3 && damageAmount > b.dmg * 2);
                spawnFloatingNumber(state, e.x, e.y, Math.round(damageAmount).toString(), isCritVisible ? '#ef4444' : '#22d3ee', isCritVisible);

                // --- ComCrit Lvl 3: Apply Death Mark ---
                // "Death marks enemy you hit every 10second"
                if (critLevel >= 3) {
                    if (!player.lastDeathMark || state.gameTime - player.lastDeathMark > 10) {
                        e.deathMarkExpiry = state.gameTime + 3; // 3 seconds
                        player.lastDeathMark = state.gameTime;
                        // Visual for Mark?
                        spawnParticles(state, e.x, e.y, '#8800FF', 8); // Reduced count
                        playSfx('rare-spawn'); // Sound cue
                    }
                }

                // --- ComLife Lvl 1: Lifesteal ---
                if (lifeLevel >= 1 && (b.id !== -1)) { // Ensure it's a projectile (Shockwave shouldn't trigger this? Bullet ID check is weak but ok)
                    // "Lifesteal from dmg dealth of projectiles"
                    const heal = damageAmount * 0.03;

                    const maxHp = calcStat(player.hp);
                    const missing = maxHp - player.curHp;

                    if (heal <= missing) {
                        player.curHp += heal;
                    } else {
                        player.curHp = maxHp;
                        // Lvl 2: Overheal Shield Chunks (Dynamic Max HP Cap)
                        if (lifeLevel >= 2) {
                            const overflow = heal - missing;
                            let shieldGain = overflow * 2.0; // Double stolen health

                            if (!player.shieldChunks) player.shieldChunks = [];
                            const currentTotalShield = player.shieldChunks.reduce((s, c) => s + c.amount, 0);

                            const effMult = getHexMultiplier(state, 'ComLife');
                            const dynamicMaxShield = maxHp * effMult;

                            if (currentTotalShield < dynamicMaxShield) {
                                // Cap to dynamicMaxShield
                                shieldGain = Math.min(shieldGain, dynamicMaxShield - currentTotalShield);
                                player.shieldChunks.push({ amount: shieldGain, expiry: now + 3000 });
                            }
                        }
                    }
                }

                // Crit Visuals
                if (b.isCrit) {
                    e.critGlitchUntil = now + 100; // Set glitch timer (100ms)
                    state.critShake = Math.min(state.critShake + 8, 20); // Add heavy shake

                } else {
                    if (onEvent) onEvent('hit');
                }

                // ELITE SKILL: SQUARE THORNS (Blade Mail)
                if (e.isElite && e.shape === 'square') {
                    const rawReflectDmg = Math.max(1, Math.floor(e.maxHp * 0.002));
                    const armor = calcStat(player.arm);
                    const reflectDmg = Math.max(0, rawReflectDmg - armor);

                    // Cap damage to never kill player (leave at least 1 HP)
                    const safeDmg = Math.min(reflectDmg, player.curHp - 1);
                    if (safeDmg > 0) {
                        // Check Shield First
                        if (player.shield && player.shield > 0) {
                            if (player.shield >= safeDmg) {
                                player.shield -= safeDmg;
                            } else {
                                const rem = safeDmg - player.shield;
                                player.shield = 0;
                                player.curHp -= rem;
                                player.damageTaken += rem;
                            }
                        } else {
                            player.curHp -= safeDmg;
                            player.damageTaken += safeDmg;
                        }

                        if (onEvent) onEvent('player_hit', { dmg: safeDmg }); // Trigger red flash
                        spawnParticles(state, player.x, player.y, '#FF0000', 3); // Visual feedback
                        spawnFloatingNumber(state, player.x, player.y, Math.round(safeDmg).toString(), '#ef4444', false);
                    }
                }

                // --- ComCrit Lvl 2: Execute ---
                if (critLevel >= 2 && !e.boss && e.hp < e.maxHp * 0.5) {
                    if (Math.random() < 0.10) {
                        const remainingHp = Math.round(e.hp);
                        e.hp = 0; // Execute
                        e.isExecuted = true; // Mark for no particles in handleEnemyDeath

                        // "Death Color" (Greyish) - Combined into one line for clarity.
                        // Shifted 10px to the right to clear the enemy model.
                        spawnFloatingNumber(state, e.x + 10, e.y - 10, `EXEC ${remainingHp}`, '#64748b', false);

                        playSfx('rare-kill');
                    }
                }

                // 2. Handle Rare Transitions (These may shift phase)
                if (e.isRare) {
                    if (e.rarePhase === 0) {
                        // PHASE 1 is now PROJECTILE IMMUNE (User Request)
                        // Can only be triggered by proximity (Player coming close)
                        b.hits.add(e.id); // Register hit so it doesn't try again next frame
                        // No phase change here
                    } else if (e.rarePhase === 1) {
                        // Stage 2 -> 3 (Orange -> Red)
                        e.rarePhase = 2;
                        e.rareTimer = state.gameTime;
                        e.palette = ['#EF4444', '#DC2626', '#B91C1C']; // Red Shift

                        // Phase 3 Stats
                        e.spd = state.player.speed * 1.4; // 1.4x Player Speed
                        e.invincibleUntil = Date.now() + 2000; // 2s Immunity

                        // Refresh Skills
                        e.shieldCd = 0; // Reset Barrels
                        e.panicCooldown = 0; // Reset Smoke (reusing panicCooldown for smoke CD)
                        e.lastDodge = 0; // Reset internal logic

                        // Smoke Screen Visual
                        spawnParticles(state, e.x, e.y, ['#FFFFFF', '#808080'], 150, 400, 100);
                        playSfx('smoke-puff');

                        e.hp = 1000; e.maxHp = 1000; // Ensure survival
                        e.knockback = { x: 0, y: 0 };
                        b.life = 0; // Consume bullet

                        // Don't die yet
                        if (onEvent) onEvent('hit');
                        return; // Skip death check
                    } else if (e.rarePhase === 2) {
                        // Phase 3: Check Immunity
                        if (e.invincibleUntil && Date.now() < e.invincibleUntil) {
                            spawnParticles(state, e.x, e.y, '#FFFFFF', 5); // Immune feedback
                            b.life = 0;
                            return;
                        }
                        // Vulnerable -> Death
                        e.hp = 0;
                    }
                }

                // 3. Common Death Check
                if (e.hp <= 0 && !e.dead) {
                    handleEnemyDeath(state, e, onEvent);
                }

                // 4. Bullet Removal
                if (b.pierce <= 0 || b.life <= 0) {
                    bullets.splice(i, 1);
                    bulletRemoved = true;
                    break;
                }
            }
        }

        if (!bulletRemoved && b.life <= 0) {
            bullets.splice(i, 1);
        }
    }

    // --- ENEMY BULLETS ---
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const eb = enemyBullets[i];
        eb.x += eb.vx;
        eb.y += eb.vy;
        eb.life--;

        if (!isInMap(eb.x, eb.y)) {
            enemyBullets.splice(i, 1);
            continue;
        }

        // --- Collision with Zombies (They block bullets) ---
        let hitZombie = false;
        const nearbyZombies = state.spatialGrid.query(eb.x, eb.y, 50);
        for (const z of nearbyZombies) {
            if (z.isZombie && z.zombieState === 'active' && !z.dead) {
                const zDist = Math.hypot(z.x - eb.x, z.y - eb.y);
                if (zDist < z.size + 10) {
                    if (z.zombieHearts !== undefined) {
                        z.zombieHearts--;
                        spawnParticles(state, z.x, z.y, '#4ade80', 5);
                        playSfx('impact');
                        if (z.zombieHearts <= 0) {
                            z.dead = true;
                            z.hp = 0;
                            spawnParticles(state, z.x, z.y, '#4ade80', 15);
                        }
                    }
                    hitZombie = true;
                    break;
                }
            }
        }

        if (hitZombie) {
            enemyBullets.splice(i, 1);
            continue;
        }

        const distP = Math.hypot(player.x - eb.x, player.y - eb.y);
        if (distP < player.size + 10) {
            const armorValue = calcStat(player.arm);
            const armRedMult = 1 - (0.95 * (armorValue / (armorValue + 5263)));

            const projRedRaw = calculateLegendaryBonus(state, 'proj_red_per_kill');
            const projRed = Math.min(80, projRedRaw); // Cap at 80% reduction
            const projRedMult = 1 - (projRed / 100);

            const dmg = Math.max(0, (eb.dmg * armRedMult) * projRedMult);

            // Check Shield Chunks
            let absorbedDmg = 0;
            if (player.shieldChunks && player.shieldChunks.length > 0) {
                let remainingToAbsorb = dmg;
                for (let k = 0; k < player.shieldChunks.length; k++) {
                    const chunk = player.shieldChunks[k];
                    if (chunk.amount >= remainingToAbsorb) {
                        chunk.amount -= remainingToAbsorb;
                        absorbedDmg += remainingToAbsorb;
                        remainingToAbsorb = 0;
                        break;
                    } else {
                        absorbedDmg += chunk.amount;
                        remainingToAbsorb -= chunk.amount;
                        chunk.amount = 0;
                    }
                }
                player.shieldChunks = player.shieldChunks.filter(c => c.amount > 0);
            }

            const finalDmg = Math.max(0, dmg - absorbedDmg);

            if (dmg > 0) {
                if (finalDmg > 0) {
                    player.curHp -= finalDmg;
                    player.damageTaken += finalDmg;
                    if (onEvent) onEvent('player_hit', { dmg: finalDmg });
                }
                spawnFloatingNumber(state, player.x, player.y, Math.round(dmg).toString(), '#ef4444', false);
            }

            enemyBullets.splice(i, 1);
            continue;
        }

        if (eb.life <= 0) {
            enemyBullets.splice(i, 1);
        }
    }

    // Shield Cleanup
    if (player.shieldChunks) {
        player.shieldChunks = player.shieldChunks.filter(c => now < c.expiry && c.amount > 0);
    }
}
