import type { GameState, Player } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';

export const createInitialPlayer = (): Player => ({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    size: 10,
    speed: 5.3,
    hp: { base: 150, flat: 0, mult: 0 },
    curHp: 150,
    dmg: { base: 50, flat: 0, mult: 0 },
    atk: { base: 200, flat: 0, mult: 0 },
    reg: { base: 1, flat: 0, mult: 0 },
    arm: { base: 0, flat: 0, mult: 0 },
    xp_per_kill: { base: 25, flat: 0 },
    xp: { current: 0, needed: 100 },
    level: 1,
    damageDealt: 0,
    damageTaken: 0,
    damageBlocked: 0,
    upgradesCollected: [],
    lastShot: 0,
    multi: 1,
    pierce: 1,
    droneCount: 0,
    lastAngle: 0,
    targetAngle: 0,
    faceAngle: 0
});

export const createInitialGameState = (): GameState => ({
    player: createInitialPlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    drones: [],
    particles: [],
    camera: { x: 0, y: 0 },
    score: 0,
    gameTime: 0,
    isPaused: false,
    gameOver: false,
    nextBossSpawnTime: 120, // 2 minutes
    nextBossId: 0,
});
