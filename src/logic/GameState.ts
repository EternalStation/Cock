import type { GameState, Player, PlayerClass } from './types';

export const createInitialPlayer = (selectedClass?: PlayerClass): Player => {
    const p: Player = {
        x: 0,
        y: 0,
        size: 10,
        speed: 5.3,
        dust: 0,
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
        damageBlockedByArmor: 0,
        damageBlockedByCollisionReduc: 0,
        damageBlockedByProjectileReduc: 0,
        wallsHit: 0,
        upgradesCollected: [],
        lastShot: 0,
        multi: 1,
        pierce: 1,
        droneCount: 0,
        lastAngle: 0,
        targetAngle: 0,
        faceAngle: 0,
        knockback: { x: 0, y: 0 },
        activeSkills: [],
        playerClass: selectedClass?.id
    };

    if (selectedClass) {
        // Multiplicative stats (stored as integer percentages, e.g. 25 for +25%)
        if (selectedClass.stats.hpMult) p.hp.mult += selectedClass.stats.hpMult * 100;
        if (selectedClass.stats.dmgMult) p.dmg.mult += selectedClass.stats.dmgMult * 100;
        if (selectedClass.stats.atkMult) p.atk.mult += selectedClass.stats.atkMult * 100;
        if (selectedClass.stats.xpMult) p.xp_per_kill.mult += selectedClass.stats.xpMult * 100;
        if (selectedClass.stats.regMult) p.reg.mult += selectedClass.stats.regMult * 100;
        if (selectedClass.stats.armMult) p.arm.mult += selectedClass.stats.armMult * 100;

        // Flat/Direct stats
        if (selectedClass.stats.spdMult) p.speed *= (1 + selectedClass.stats.spdMult);
        if (selectedClass.stats.regFlat) p.reg.flat += selectedClass.stats.regFlat;

        // Custom start conditions
        if (selectedClass.id === 'aigis') {
            // Aigis starts with higher durability focus? 
            // Most class logic is in ProjectileLogic.
        }

        // Finalize HP using unified calcStat logic (but locally to avoid circular)
        const maxHp = p.hp.base * (1 + p.hp.mult / 100);
        p.curHp = maxHp;
    }

    return p;
};

import { SpatialGrid } from './SpatialGrid';

export const createInitialGameState = (): GameState => ({
    player: createInitialPlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    floatingNumbers: [],
    drones: [],
    particles: [],
    areaEffects: [],
    camera: { x: 0, y: 0 },
    score: 0,
    killCount: 0,
    bossKills: 0,
    gameTime: 0,
    meteoritesPickedUp: 0,
    portalsUsed: 0,
    snitchCaught: 0,
    timeInArena: { 0: 0, 1: 0, 2: 0 },
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
    critShake: 0,
    spatialGrid: new SpatialGrid(250), // 250px cells
    activeEvent: null,
    nextEventCheckTime: 60, // First check at 1 minute

    // Portal / Arena Defaults
    currentArena: 0,
    portalState: 'closed',
    portalTimer: 240, // 240s = 4 minutes (Cycle)
    portalOpenDuration: 10, // 10 seconds open
    transferTimer: 0,
    nextArenaId: null,

    // Inventory Defaults
    meteoriteDust: 0,
    meteorites: [],
    inventory: Array(78).fill(null), // 78 slots for 6x13 Grid

    // Module Menu Defaults
    showModuleMenu: false,
    showStats: false,
    showSettings: false,
    showLegendarySelection: false,
    legendaryOptions: null,
    pendingLegendaryHex: null,
    upgradingHexIndex: null,
    upgradingHexTimer: 0,
    unseenMeteorites: 0,
    moduleSockets: {
        hexagons: Array(6).fill(null),
        diamonds: Array(12).fill(null),
        center: null
    },
    chassisDetailViewed: false
});
