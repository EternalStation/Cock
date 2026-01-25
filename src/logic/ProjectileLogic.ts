import { isInMap } from './MapLogic';
import { playSfx } from './AudioLogic';
import { calcStat } from './MathUtils';
import type { GameState } from './types';
import { spawnParticles } from './ParticleLogic';
import { trySpawnMeteorite } from './LootLogic';

export function spawnBullet(state: GameState, x: number, y: number, angle: number, dmg: number, pierce: number, offsetAngle: number = 0) {
    const spd = 12;
    state.bullets.push({
        id: Math.random(),
        x, y,
        vx: Math.cos(angle + offsetAngle) * spd,
        vy: Math.sin(angle + offsetAngle) * spd,
        dmg,
        pierce,
        life: 140, // Frames
        isEnemy: false,
        hits: new Set(),
        size: 4
    });
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

            // Critical: Only hit active, alive enemies that haven't been hit by THIS bullet
            // Keep barrels (Snitch bullet blockers) as hittable objects even if they are neutral
            if (e.dead || e.hp <= 0 || b.hits.has(e.id)) continue;

            const dist = Math.hypot(e.x - b.x, e.y - b.y);
            const hitRadius = e.size + 10;

            if (dist < hitRadius) {
                // 1. Apply Damage
                e.hp -= b.dmg;
                player.damageDealt += b.dmg;
                b.hits.add(e.id);
                b.pierce--;
                if (onEvent) onEvent('hit');

                // ELITE SKILL: SQUARE THORNS (Blade Mail)
                if (e.isElite && e.shape === 'square') {
                    const rawReflectDmg = Math.max(1, Math.floor(e.maxHp * 0.002));
                    const armor = calcStat(player.arm);
                    const reflectDmg = Math.max(0, rawReflectDmg - armor);

                    // Cap damage to never kill player (leave at least 1 HP)
                    const safeDmg = Math.min(reflectDmg, player.curHp - 1);
                    if (safeDmg > 0) {
                        player.curHp -= safeDmg;
                        player.damageTaken += safeDmg;
                        if (onEvent) onEvent('player_hit', { dmg: safeDmg }); // Trigger red flash
                        spawnParticles(state, player.x, player.y, '#FF0000', 3); // Visual feedback
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
                    e.dead = true;
                    state.killCount++;
                    state.score += 1;
                    spawnParticles(state, e.x, e.y, e.palette[0], 12);
                    trySpawnMeteorite(state, e.x, e.y);

                    if (e.isRare && e.rareReal) {
                        playSfx('rare-kill');
                        state.rareRewardActive = true;
                        state.rareSpawnActive = false;
                        // Massive XP Reward for Legend
                        player.xp.current += player.xp.needed;
                    } else {
                        // Standard XP Reward
                        let xpGain = player.xp_per_kill.base;
                        if (e.xpRewardMult !== undefined) {
                            xpGain *= e.xpRewardMult;
                        } else if (e.isElite) {
                            xpGain *= 12; // Elite = 12x XP
                        }
                        player.xp.current += xpGain;
                    }

                    // Level Up Loop
                    while (player.xp.current >= player.xp.needed) {
                        player.xp.current -= player.xp.needed;
                        player.level++;
                        player.xp.needed *= 1.10;
                        if (onEvent) onEvent('level_up');
                    }
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

        const distP = Math.hypot(player.x - eb.x, player.y - eb.y);
        if (distP < player.size + 10) {
            const armor = calcStat(player.arm);
            const dmg = Math.max(0, eb.dmg - armor);
            player.curHp -= dmg;
            player.damageTaken += dmg;
            if (onEvent) onEvent('player_hit', { dmg });
            enemyBullets.splice(i, 1);
            continue;
        }

        if (eb.life <= 0) {
            enemyBullets.splice(i, 1);
        }
    }
}
