export type Vector = { x: number; y: number };

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}


export interface PlayerStats {
    base: number;
    flat: number;
    mult: number;
}

export interface Player {
    x: number;
    y: number;
    size: number;
    speed: number;
    hp: PlayerStats;
    curHp: number;
    dmg: PlayerStats;
    atk: PlayerStats; // Cooldown in ms (lower is faster)
    // Stats Tracking
    damageDealt: number;
    damageTaken: number;
    damageBlocked: number;
    upgradesCollected: string[]; // Names of upgrades collected
    reg: PlayerStats;
    arm: PlayerStats;
    xp_per_kill: { base: number; flat: number };
    xp: { current: number; needed: number };
    level: number;
    lastShot: number;
    multi: number;
    pierce: number;
    droneCount: number;
    lastAngle: number;
    targetAngle: number;
    faceAngle: number;
}

export interface Bullet {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    dmg: number;
    pierce: number; // Penetration count
    life: number;
    isEnemy: boolean;
    hits: Set<number>; // Enemy IDs hit
    color?: string;
}

export type ShapeType = 'circle' | 'triangle' | 'square' | 'diamond' | 'pentagon' | 'minion';

export interface ShapeDef {
    type: ShapeType;
    role: string;
    speedMult: number;
    hpMult: number;
    behavior: 'chase' | 'charge' | 'tank' | 'snipe' | 'summon';
    spawnWeight: number;
    sizeMult: number;
}

export interface PaletteDef {
    name: string;
    id: string;
    colors: [string, string, string]; // Core, Inner, Outer
}

export interface Enemy {
    id: number;
    type: ShapeType | 'boss'; // Changed from generic string
    x: number;
    y: number;
    size: number;
    hp: number;
    maxHp: number;
    spd: number;
    boss: boolean;
    bossType: number;
    lastAttack: number;
    dead: boolean;

    // New Progression Props
    shape: ShapeType;
    shellStage: number; // 0, 1, 2 (Core, Inner, Outer)
    palette: string[]; // [Core, Inner, Outer]
    pulsePhase: number; // 0-1 for breathing animation

    // AI States
    summonState?: number; // 0: moving, 1: wait, 2: cast
    dashState?: number; // 0: normal, 1: dash
    timer?: number; // General purpose timer
    dodgeDir?: number; // -1 or 1 for Dodge

    // New Props for Refinements
    seen?: boolean; // Has been seen by camera? (Pentagon)
    spiralAngle?: number; // For Minion Black hole movement
    spiralRadius?: number; // For Minion Black hole movement
}

export interface Upgrade {
    id: string;
    name: string;
    desc: string;
    icon: string;
    isSpecial?: boolean;
}

export interface UpgradeChoice {
    type: Upgrade;
    rarity: Rarity;
    isSpecial?: boolean;
}

export interface Rarity {
    id: string;
    label: string;
    weight: number;
    color: string;
}

export interface GameState {
    player: Player;
    enemies: Enemy[];
    bullets: Bullet[];
    enemyBullets: Bullet[];
    drones: { a: number; last: number; x: number; y: number }[];
    particles: Particle[];
    camera: Vector;
    score: number;
    gameTime: number;
    isPaused: boolean;
    gameOver: boolean;
    nextBossSpawnTime: number;
    nextBossId: number; // To track waves
}
