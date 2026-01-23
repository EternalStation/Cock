import type { GameState, Bullet } from './types';
import { calcStat, getDefenseReduction } from './MathUtils';
import { spawnParticles } from './ParticleLogic';
import { playSfx } from './AudioLogic';
// import { spawnUpgrades } from './UpgradeLogic'; // Triggered via callback now

export function spawnBullet(state: GameState, x: number, y: number, angle: number, dmg: number, pierce: number, offset: number = 0) {
    const speed = 13.8; // +15% from 12
    const newBullet: Bullet = {
        id: Math.random(),
        x, y,
        vx: Math.cos(angle + offset) * speed,
        vy: Math.sin(angle + offset) * speed,
        dmg,
        pierce,
        isEnemy: false,
        life: 120,
        hits: new Set()
    };
    state.bullets.push(newBullet);
}

export function spawnEnemyBullet(state: GameState, x: number, y: number, angle: number, dmg: number, color?: string, offset: number = 0) {
    const speed = 5.2; // +15% from 4.5
    const newBullet: Bullet = {
        id: Math.random(),
        x, y,
        vx: Math.cos(angle + offset) * speed,
        vy: Math.sin(angle + offset) * speed,
        dmg,
        pierce: 1,
        isEnemy: true,
        life: 300,
        hits: new Set(),
        color
    };
    state.enemyBullets.push(newBullet);
}

export function updateProjectiles(state: GameState, onEvent?: (type: string, data?: any) => void) {
    const { player, enemies } = state;

    // Player Bullets
    state.bullets = state.bullets.filter(b => {
        b.x += b.vx;
        b.y += b.vy;
        b.life--;

        // Collision with Enemies
        enemies.forEach(e => {
            // Only hit if enemy is still alive and bullet hasn't hit this enemy yet
            if (!e.dead && e.hp > 0 && !b.hits.has(e.id) && Math.hypot(e.x - b.x, e.y - b.y) < e.size + 10) {
                e.hp -= b.dmg;
                state.player.damageDealt += b.dmg; // Track Dealt
                b.hits.add(e.id);
                b.pierce--;
                if (onEvent) onEvent('hit');

                if (e.isRare) {
                    // PHASE 0 (Passive) -> PHASE 1 (Alert/Teleport) ON HIT
                    if (e.rarePhase === 0) {
                        // Trigger Phase 1 (Alert/Defensive) - ORANGE
                        e.rarePhase = 1;
                        e.rareTimer = state.gameTime;
                        e.spd = 8;
                        e.teleported = true;
                        e.longTrail = [];
                        e.palette = ['#F97316', '#EA580C', '#C2410C']; // Orange Palette (Phase 2 Visuals)

                        // Heal to full to ensure he can be hit again (Fixing 'no damage in phase 2' bug)
                        e.hp = e.maxHp;

                        // Teleport behind player (Reuse logic basically)
                        const dx = e.x - player.x;
                        const dy = e.y - player.y;
                        e.x = player.x - (dx * 0.8);
                        e.y = player.y - (dy * 0.8);

                        playSfx('rare-spawn');
                        return;
                    }

                    // PHASE 1 (Alert) -> PHASE 2 (Split/Aggressive) ON HIT
                    if (e.rarePhase === 1) {
                        // Trigger Phase 2 (Aggressive Split) - RED
                        e.rarePhase = 2;
                        e.rareTimer = state.gameTime;
                        e.spd = 5.2; // Reduced by 20% (6.5 -> 5.2)
                        e.invincibleUntil = Date.now() + 2500; // 2.5s Invincibility (Smoke Cover)
                        e.teleported = true;
                        e.longTrail = [];

                        // SMOKE EFFECT (Octopus Ink Style) - Updated
                        // "3D Grey" Gradient (White -> Black mix)
                        const greyGradient = ['#FFFFFF', '#E0E0E0', '#C0C0C0', '#A0A0A0', '#808080', '#606060', '#404040', '#202020', '#000000'];
                        spawnParticles(state, e.x, e.y, greyGradient, 60, 300, 90);

                        // SET HP TO 1 for BOTH (After damage calculation, force it)
                        e.hp = 1;
                        e.maxHp = 1;

                        // CHANGE COLOR TO RED (Aggressive)
                        const redPalette = ['#EF4444', '#DC2626', '#B91C1C'];
                        e.palette = redPalette;

                        // Spawn Decoy
                        const decoy: any = { ...e }; // Copy properties including new Red palette
                        decoy.id = Math.random();
                        decoy.rareReal = false; // It's a fake
                        decoy.hp = 1;
                        decoy.maxHp = 1;
                        decoy.parentId = e.id;
                        // Split Offset - Reduced by 2x (60 -> 30)
                        decoy.x += 30; decoy.y += 30;
                        e.x -= 30; e.y -= 30;

                        state.enemies.push(decoy);
                        return;
                    }

                    // PHASE 2 (Aggressive Split) - CHECK REAL VS FAKE
                    if (e.rarePhase === 2) {
                        // Check Invincibility
                        if (e.invincibleUntil && Date.now() < e.invincibleUntil) {
                            // If invincible, we shouldn't have taken damage. Revert damage.
                            e.hp += b.dmg;
                            return;
                        }

                        // DEAL DAMAGE (1 HP logic means death)
                        // Note: Damage was already applied by line 53 e.hp -= b.dmg


                        // DEATH LOGIC
                        if (e.hp <= 0 && !e.dead) {
                            e.dead = true;

                            // IF REAL ONE DIES
                            if (e.rareReal) {
                                spawnParticles(state, e.x, e.y, '#F59E0B', 40);
                                playSfx('rare-kill');
                                state.score += 5000;
                                state.killCount++;
                                state.rareRewardActive = true;

                                // REWARD: Full Level Up (Keep overflow)
                                const xpNeededForLevel = player.xp.needed;
                                player.xp.current += xpNeededForLevel; // Add full level worth of XP

                                // Check level up immediately so overflow matches expectation
                                while (player.xp.current >= player.xp.needed) {
                                    player.xp.current -= player.xp.needed; // Keep overflow
                                    player.level++;
                                    player.xp.needed *= 1.10;
                                    if (onEvent) onEvent('level_up');
                                }

                                // Kill ALL fakes

                                state.enemies.forEach(other => {
                                    if (other.parentId === e.id || (!other.rareReal && other.isRare && other.id !== e.id)) {
                                        other.dead = true;
                                        spawnParticles(state, other.x, other.y, '#ffffff', 10);
                                    }
                                });
                            } else {
                                // FAKE DIES
                                spawnParticles(state, e.x, e.y, '#ef4444', 15);
                                // Real one continues...
                            }
                            return;
                        }
                        return;
                    }
                }

                if (e.hp <= 0 && !e.dead) {
                    e.dead = true;
                    spawnParticles(state, e.x, e.y, e.palette[0], 8);
                    state.score++;
                    state.killCount++;

                    const baseXp = e.boss
                        ? 0
                        : (40 + (2 * player.level) + player.xp_per_kill.flat);

                    const xpMult = 1 + (player.xp_per_kill.mult / 100);
                    const totalXp = baseXp * xpMult;

                    player.xp.current += totalXp;

                    if (e.boss) {
                        if (onEvent) onEvent('boss_kill');
                    }

                    // Level Up Logic with Rollover
                    while (player.xp.current >= player.xp.needed) {
                        player.xp.current -= player.xp.needed; // Keep overflow
                        player.level++;
                        player.xp.needed *= 1.10;
                        if (onEvent) onEvent('level_up');
                    }
                }
            }
        });

        return b.pierce > 0 && b.life > 0;
    });

    // Enemy Bullets
    state.enemyBullets = state.enemyBullets.filter(eb => {
        eb.x += eb.vx;
        eb.y += eb.vy;
        eb.life--;

        // Hexagon collision for player (honeycomb hitbox)
        const honeycombRadius = 8 * Math.sqrt(3) * 1.15; // Match player honeycomb size (cellSize = 8)
        if (Math.hypot(eb.x - player.x, eb.y - player.y) < honeycombRadius + 4) {
            const reduction = getDefenseReduction(calcStat(player.arm));
            const actualDmg = eb.dmg * (1 - reduction);
            player.damageTaken += actualDmg; // Track Taken
            player.damageBlocked += (eb.dmg - actualDmg); // Track Blocked
            player.curHp -= actualDmg;
            if (onEvent) onEvent('player_hit', { dmg: eb.dmg });

            if (player.curHp <= 0) {
                state.gameOver = true;
                if (onEvent) onEvent('game_over');
            }
            return false; // Bullet destroyed
        }
        return eb.life > 0;
    });

    // Enemy Collision (Body Damage) - Hexagon-based collision
    enemies.forEach(e => {
        if (!e.dead) {
            // Calculate distance from enemy center to player center
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            const dist = Math.hypot(dx, dy);

            // Hexagon collision: approximate as circle with radius = honeycomb outer edge
            // Honeycomb spans ~3 cells wide (cellSize * sqrt(3) * 2)
            const honeycombRadius = 8 * Math.sqrt(3) * 1.15; // cellSize = 8

            // Check if enemy is touching the honeycomb edge - ENEMY DIES on contact
            if (dist < e.size + honeycombRadius) {
                if (e.isRare) {
                    // Startle / Teleport Logic
                    const escapeA = Math.random() * 6.28;
                    e.x += Math.cos(escapeA) * 200;
                    e.y += Math.sin(escapeA) * 200;
                    return; // Skip death and damage
                }

                e.dead = true; // Enemy dies on contact

                // Percentage Based Damage Logic
                const percentDmg = e.maxHp * 0.10;
                // Add flat base damage to ensure early game enemies still hurt if 30% is too low (e.g. 50hp * 0.3 = 15)
                // But user asked for "link dmg to % of total enemiy health... if at start enemies have 50 hp... lose 30% of enemies hp"
                // So purely 10% of enemy max HP.
                const rawDmg = Math.max(10, percentDmg); // Safety floor of 10 damage

                const reduction = getDefenseReduction(calcStat(player.arm));
                const actualDmg = rawDmg * (1 - reduction);

                player.damageTaken += actualDmg; // Track Taken
                player.damageBlocked += (rawDmg - actualDmg); // Track Blocked
                player.curHp -= actualDmg;

                if (onEvent) onEvent('player_hit', { dmg: rawDmg });

                if (player.curHp <= 0) {
                    state.gameOver = true;
                    if (onEvent) onEvent('game_over');
                }
            }
        }
    });

    // Remove dead enemies
    state.enemies = state.enemies.filter(e => !e.dead);
}
