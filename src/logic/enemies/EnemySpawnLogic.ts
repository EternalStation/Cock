
import type { GameState, Enemy, ShapeType } from '../types';
import { SHAPE_DEFS, PALETTES, PULSE_RATES, SHAPE_CYCLE_ORDER } from '../constants';
import { isInMap, getArenaIndex, getRandomPositionInArena } from '../MapLogic';
import { playSfx } from '../AudioLogic';
// import { spawnParticles } from '../ParticleLogic'; // Unused
import { GAME_CONFIG } from '../GameConfig';

// Helper to determine current game era params
// Helper to determine current game era params
export function getProgressionParams(gameTime: number) {
    const minutes = Math.floor(gameTime / 60);
    const eraIndex = Math.floor(minutes / 15);
    const fluxState = Math.floor((minutes % 15) / 5); // 0: Containment, 1: Active Flux, 2: Overload
    const shapeIndex = minutes % 5;

    // Cycle shapes: Circle -> Triangle -> Square -> Diamond -> Pentagon
    const shapeId = SHAPE_CYCLE_ORDER[shapeIndex];
    const shapeDef = SHAPE_DEFS[shapeId];

    // Era Palette (Green -> Blue -> Purple -> Orange -> Red)
    const eraPalette = PALETTES[eraIndex % PALETTES.length];

    // Pulse Speed
    const pulseDef = PULSE_RATES.find(p => minutes < p.time) || PULSE_RATES[PULSE_RATES.length - 1];

    return { shapeDef, eraPalette, fluxState, pulseDef };
}

export function getEventPalette(state: GameState): [string, string, string] | null {
    if (state.activeEvent?.type === 'solar_emp') {
        return ['#f59e0b', '#d97706', '#92400e']; // Amber/Warning
    }
    return null;
}

export function spawnEnemy(state: GameState, x?: number, y?: number, shape?: ShapeType, isBoss: boolean = false, bossTier?: number) {
    const { player, gameTime } = state;
    const { shapeDef, eraPalette, fluxState } = getProgressionParams(gameTime);

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
    const minutes = gameTime / 60;
    const cycleCount = Math.floor(minutes / 5);
    const difficultyMult = 1 + (minutes * Math.log2(2 + minutes) / 30);
    const hpMult = Math.pow(1.2, cycleCount) * SHAPE_DEFS[chosenShape].hpMult;
    const baseHp = 60 * Math.pow(1.186, minutes) * difficultyMult; // Tuned for 20k HP @ 20min, 250M HP @ 60min

    const isLvl2 = isBoss && (bossTier === 2 || (minutes >= 10 && bossTier !== 1));
    const size = isBoss ? (isLvl2 ? 60 : 50) : (20 * SHAPE_DEFS[chosenShape].sizeMult);
    let hp = (isBoss ? baseHp * 20 : baseHp) * hpMult;


    const eventPalette = getEventPalette(state);
    const finalPalette = eventPalette || eraPalette.colors;

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
        bossTier: bossTier || 0, // 0 = Auto
        dead: false,
        shape: chosenShape as ShapeType,
        shellStage: 2,
        palette: finalPalette,
        eraPalette: finalPalette,
        fluxState: fluxState,
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
        isElite: false,
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

    const rareEnemy: Enemy = {
        id: Math.random(),
        type: 'snitch',
        x, y,
        hp: GAME_CONFIG.ENEMY.SNITCH_HP,
        maxHp: GAME_CONFIG.ENEMY.SNITCH_HP,
        spd: player.speed * GAME_CONFIG.ENEMY.SNITCH_SPEED_MULT,
        boss: false, bossType: 0, bossAttackPattern: 0, lastAttack: 0, dead: false,
        shape: 'snitch',
        shellStage: 2,
        palette: ['#FACC15', '#EAB308', '#CA8A04'],
        eraPalette: ['#FACC15', '#EAB308', '#CA8A04'],
        fluxState: 0,
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

export function manageRareSpawnCycles(state: GameState) {
    const { gameTime, rareSpawnCycle, rareSpawnActive } = state;
    if (rareSpawnActive) return;

    const nextSpawnTime = 60 + (rareSpawnCycle * 120);

    if (gameTime >= nextSpawnTime) {
        spawnRareEnemy(state);
        state.rareSpawnCycle++;
    }
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
        eraPalette: ['#475569', '#334155', '#1e293b'],
        fluxState: 0,
        pulsePhase: 0,
        rotationPhase: Math.random() * 6.28,
        spawnedAt: state.gameTime,
        knockback: { x: 0, y: 0 },
        isRare: false,
        isNeutral: true // Tag as neutral for auto-aim (ignored)
    };
    state.enemies.push(shield);
}
