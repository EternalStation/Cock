import type { GameState, Enemy } from './types';
import { spawnParticles } from './ParticleLogic';
import { playSfx } from './AudioLogic';
import { getLegendaryOptions, getHexLevel, calculateLegendaryBonus } from './LegendaryLogic';
import { trySpawnMeteorite } from './LootLogic';

export function handleEnemyDeath(state: GameState, e: Enemy, onEvent?: (event: string, data?: any) => void) {
    if (e.dead) return;
    e.dead = true; e.hp = 0;
    state.killCount++; state.score++;
    if (!e.isExecuted) {
        spawnParticles(state, e.x, e.y, e.palette[0], 12);
    }

    // Meteorite Drop Check
    trySpawnMeteorite(state, e.x, e.y);

    if (e.boss) {
        state.legendaryOptions = getLegendaryOptions(state);
        state.showLegendarySelection = true;
        state.isPaused = true;
        playSfx('rare-spawn');
        if (onEvent) onEvent('boss_kill');
    }

    if (e.isRare && e.rareReal) {
        playSfx('rare-kill');
        state.rareRewardActive = true;
        state.rareSpawnActive = false;
        state.player.xp.current += state.player.xp.needed;
    } else {
        // Consolidated XP Logic (Matches PlayerLogic/ProjectileLogic advanced formula)
        let xpBase = state.player.xp_per_kill.base;

        if (e.xpRewardMult !== undefined) {
            xpBase *= e.xpRewardMult;
        } else if (e.isElite) {
            xpBase *= 12; // Elite = 12x XP
        }

        if (state.currentArena === 0) xpBase *= 1.15; // +15% XP in Economic Hex

        // Legendary XP Bonuses
        const hexFlat = calculateLegendaryBonus(state, 'xp_per_kill');
        const hexPct = calculateLegendaryBonus(state, 'xp_pct_per_kill');

        const totalFlat = xpBase + state.player.xp_per_kill.flat + hexFlat;
        const normalMult = 1 + (state.player.xp_per_kill.mult / 100);
        const hexMult = 1 + (hexPct / 100);

        const finalXp = totalFlat * normalMult * hexMult;

        state.player.xp.current += finalXp;
    }

    // Necromancy: Only ComLife Lvl 4+ (10% Chance) - No Infection recycling
    let shouldSpawnZombie = false;

    // Direct check for ComLife level to ensure robustness
    let comLifeLevel = 0;
    if (state.moduleSockets && state.moduleSockets.hexagons) {
        const hex = state.moduleSockets.hexagons.find(h => h && (h.type === 'ComLife'));
        if (hex) comLifeLevel = hex.level;
    }
    // Fallback
    if (comLifeLevel === 0) {
        comLifeLevel = getHexLevel(state, 'ComLife');
    }

    if (!e.isZombie && comLifeLevel >= 4) {
        if (Math.random() < 0.10) { // 10% Chance
            shouldSpawnZombie = true;
        }
    }

    if (shouldSpawnZombie) {
        const zombie: Enemy = {
            id: Math.random(),
            type: e.type,
            shape: e.shape, // Preserve shape of fallen enemy
            x: e.x, y: e.y,
            size: e.size,
            hp: Math.floor(e.maxHp * 0.5), // 50% HP
            maxHp: Math.floor(e.maxHp * 0.5),
            spd: 1.92,
            boss: false,
            bossType: 0,
            bossAttackPattern: 0,
            lastAttack: 0,
            dead: false,
            shellStage: 0,
            palette: ['#4ade80', '#22c55e', '#166534'], // Undead Green
            pulsePhase: 0,
            rotationPhase: 0,
            isZombie: true,
            zombieState: 'dead', // Starts as corpse (Invisible/Waiting)
            zombieTimer: state.gameTime * 1000 + 2000, // 2s delay before rising (digging)
            zombieSpd: 1.92,
            vx: 0,
            vy: 0,
            knockback: { x: 0, y: 0 },
            frozen: 0,
            isElite: false,
            isRare: false
        } as any;
        state.enemies.push(zombie);
    }

    // Level Up Loop
    while (state.player.xp.current >= state.player.xp.needed) {
        state.player.xp.current -= state.player.xp.needed;
        state.player.level++;
        state.player.xp.needed *= 1.10;
        if (onEvent) onEvent('level_up');
    }
}
