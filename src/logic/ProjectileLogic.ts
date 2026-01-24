import { isInMap } from './MapLogic';
import { playSfx } from './AudioLogic';
import type { GameState } from './types';
import { spawnParticles } from './ParticleLogic';

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
    const { bullets, enemyBullets, enemies, player } = state;

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
        for (let j = 0; j < enemies.length; j++) {
            const e = enemies[j];

            // Critical: Only hit active, alive enemies that haven't been hit by THIS bullet
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

                // 2. Handle Rare Transitions (These may consume bullet or shift phase)
                if (e.isRare) {
                    if (e.rarePhase === 0) {
                        e.rarePhase = 1;
                        e.palette = ['#f97316', '#ea580c', '#c2410c'];
                        e.longTrail = [];
                        const backAngle = player.faceAngle + Math.PI;
                        e.x = player.x + Math.cos(backAngle) * 400;
                        e.y = player.y + Math.sin(backAngle) * 400;
                        e.rareTimer = state.gameTime;
                        playSfx('rare-spawn');
                        b.life = 0;
                        // Note: We don't break yet, we let b.pierce handle removal
                    } else if (e.rarePhase === 1) {
                        // Phase 2 -> 3 Split
                        e.rarePhase = 2;
                        e.rareTimer = state.gameTime;
                        e.invincibleUntil = Date.now() + 3000;
                        e.palette = ['#EF4444', '#DC2626', '#B91C1C'];

                        // Dense Smoke Screen
                        spawnParticles(state, e.x, e.y, ['#FFFFFF', '#808080'], 150, 400, 100);

                        e.hp = 1; e.maxHp = 1;
                        e.rareReal = true;

                        // Randomize Decoy Spawn
                        const splitAngle = Math.random() * Math.PI * 2;
                        const splitDist = 60 + Math.random() * 40; // 60-100px
                        const dx = Math.cos(splitAngle) * splitDist;
                        const dy = Math.sin(splitAngle) * splitDist;

                        // Decoy Setup
                        const decoy: any = {
                            ...e,
                            id: Math.random(),
                            rareReal: false,
                            parentId: e.id,
                            x: e.x + dx,
                            y: e.y + dy,
                            knockback: { x: Math.cos(splitAngle) * 25, y: Math.sin(splitAngle) * 25 }
                        };

                        // Real Snitch Knockback (Opposite)
                        e.knockback = { x: Math.cos(splitAngle + Math.PI) * 25, y: Math.sin(splitAngle + Math.PI) * 25 };

                        state.enemies.push(decoy);
                        b.life = 0;
                    } else if (e.rarePhase === 2) {
                        // Standard Phase 3 death handling
                        if (e.invincibleUntil && Date.now() < e.invincibleUntil) {
                            e.hp += b.dmg; // Negate
                        } else if (e.hp <= 0 && !e.dead) {
                            // Handled by common death check below
                        }
                    }
                }

                // 3. Common Death Check
                if (e.hp <= 0 && !e.dead) {
                    e.dead = true;
                    state.killCount++;
                    state.score += 1;
                    spawnParticles(state, e.x, e.y, e.palette[0], 12);

                    if (e.isRare && e.rareReal) {
                        playSfx('rare-kill');
                        state.rareRewardActive = true;
                        state.rareSpawnActive = false;
                        // Massive XP Reward for Legend
                        player.xp.current += player.xp.needed;
                    } else {
                        // Standard XP Reward
                        const xpGain = player.xp_per_kill.base;
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
            const armor = player.arm.base + player.arm.flat; // Simplified for robustness
            const dmg = Math.max(1, eb.dmg - armor);
            player.curHp -= dmg;
            if (onEvent) onEvent('player_hit');
            enemyBullets.splice(i, 1);
            continue;
        }

        if (eb.life <= 0) {
            enemyBullets.splice(i, 1);
        }
    }
}
