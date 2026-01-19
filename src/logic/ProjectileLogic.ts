import type { GameState, Bullet } from './types';
import { calcStat, getDefenseReduction } from './MathUtils';
import { spawnParticles } from './ParticleLogic';
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

                if (e.hp <= 0 && !e.dead) {
                    e.dead = true;
                    spawnParticles(state, e.x, e.y, e.palette[0], 8);
                    state.score++;

                    const xpGain = e.boss ? 500 : (player.xp_per_kill.base + player.level + player.xp_per_kill.flat);
                    player.xp.current += xpGain;

                    if (e.boss) {
                        if (onEvent) onEvent('boss_kill');
                    }

                    if (player.xp.current >= player.xp.needed) {
                        player.level++;
                        player.xp.current = 0;
                        player.xp.needed *= 1.22;
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
                e.dead = true; // Enemy dies on contact

                // Percentage Based Damage Logic
                const percentDmg = e.maxHp * 0.30;
                // Add flat base damage to ensure early game enemies still hurt if 30% is too low (e.g. 50hp * 0.3 = 15)
                // But user asked for "link dmg to % of total enemiy health... if at start enemies have 50 hp... lose 30% of enemies hp"
                // So purely 30% of enemy max HP.
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
