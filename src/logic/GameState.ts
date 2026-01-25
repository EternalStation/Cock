import type { GameState, Player } from './types';

export const createInitialPlayer = (): Player => ({
    x: 0,
    y: 0,
    size: 10,
    speed: 5.3,
    hp: { base: 150, flat: 0, mult: 0 },
    curHp: 150,
    dmg: { base: 50, flat: 0, mult: 0 },
    atk: { base: 330, flat: 0, mult: 0 },
    reg: { base: 1, flat: 0, mult: 0 },
    arm: { base: 0, flat: 0, mult: 0 },
    xp_per_kill: { base: 25, flat: 0, mult: 0 },
    xp: { current: 0, needed: 250 },
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
    faceAngle: 0,
    knockback: { x: 0, y: 0 }
});

import { SpatialGrid } from './SpatialGrid';

export const createInitialGameState = (): GameState => ({
    player: createInitialPlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    drones: [],
    particles: [],
    camera: { x: 0, y: 0 },
    score: 0,
    killCount: 0,
    bossKills: 0,
    gameTime: 0,
    frameCount: 0,
    isPaused: false,
    gameOver: false,
    nextBossSpawnTime: 120, // 2 minutes
    nextBossId: 0,
    rareSpawnCycle: 0,
    rareSpawnActive: false,
    spawnTimer: 3.0, // 3 Second animation
    hasPlayedSpawnSound: false,
    bossPresence: 0,
    spatialGrid: new SpatialGrid(250), // 250px cells

    // Portal / Arena Defaults
    currentArena: 0,
    portalState: 'closed',
    portalTimer: 240, // 240s = 4 minutes (Cycle)
    portalOpenDuration: 10, // 10 seconds open
    transferTimer: 0,
    nextArenaId: null,

    // Inventory Defaults
    meteorites: [],
    inventory: Array(30).fill(null),
    isInventoryOpen: false,

    // Module Menu Defaults
    showModuleMenu: false,
    moduleSockets: {
        hexagons: Array(6).fill(null),
        diamonds: Array(12).fill(null)
    }
});
