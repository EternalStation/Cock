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
    upgradesCollected: import('./types').UpgradeChoice[]; // Full objects for stat tracking
    reg: PlayerStats;
    arm: PlayerStats;
    xp_per_kill: { base: number; flat: number; mult: number };
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

export type ShapeType = 'circle' | 'triangle' | 'square' | 'diamond' | 'pentagon' | 'minion' | 'snitch';

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
    bossType: number; // Shape index for legendary upgrades
    bossAttackPattern: number; // 0 = Spread Shot, 1 = Tracking Snipe
    lastAttack: number;
    dead: boolean;

    // New Progression Props
    shape: ShapeType;
    shellStage: number; // 0, 1, 2 (Core, Inner, Outer)
    palette: string[]; // [Core, Inner, Outer]
    pulsePhase: number; // 0-1 for breathing animation
    rotationPhase: number; // For slow rotation

    // AI States
    summonState?: number; // 0: moving, 1: wait, 2: cast
    dashState?: number; // 0: normal, 1: dash
    timer?: number; // General purpose timer
    dodgeDir?: number; // -1 or 1 for Dodge

    // New Props for Refinements
    seen?: boolean; // Has been seen by camera? (Pentagon)
    spiralAngle?: number; // For Minion Black hole movement
    spiralRadius?: number; // For Minion Black hole movement
    reachedRange?: boolean; // For Pentagon AI (track if 700 range reached)

    // Diamond Logic
    preferredMinDist?: number;
    preferredMaxDist?: number;
    strafeInterval?: number;

    // Boss Visual Effects
    wobblePhase?: number; // For wobble animation
    jitterX?: number; // Jitter offset X
    jitterY?: number; // Jitter offset Y
    glitchPhase?: number; // For glitch effects
    crackPhase?: number; // For crack animations
    particleOrbit?: number; // For orbiting particles (Pentagon)
    trails?: { x: number; y: number; alpha: number; rotation: number }[]; // After-images

    // Rare Enemy "Quantum Frame" Props
    isRare?: boolean;
    rarePhase?: number; // 0=Passive, 1=Alert, 2=Panic
    rareTimer?: number; // Phase duration tracker
    rareIntent?: number; // Counter for player intent
    rareReal?: boolean; // True if real, False if decoy
    canBlock?: boolean; // For Phase 2 defense (replaces blockedShots boolean flag logic)
    invincibleUntil?: number; // Timestamp for invincibility (Phase 3 start)
    parentId?: number; // For decoys to know their master
    teleported?: boolean; // Flag for Phase 2 entry
    longTrail?: { x: number; y: number }[]; // Long paint trail
    untargetable?: boolean; // If true, player bullets won't home in on it
    phase3AudioTriggered?: boolean; // Flag for Phase 3 Audio Trigger
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
    color: string;
    mult: number;
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
    killCount: number; // Dedicated kill counter
    gameTime: number;
    isPaused: boolean;
    gameOver: boolean;
    nextBossSpawnTime: number;
    nextBossId: number; // To track waves
    rareSpawnCycle: number; // Index of rare spawn cycle
    rareSpawnActive: boolean; // Is a rare enemy currently alive?
    rareRewardActive?: boolean; // Flag to show "Increased Rarity" text on next level up
    spawnTimer: number; // For start/restart animation
    hasPlayedSpawnSound?: boolean;
    bossPresence: number; // 0 to 1 smooth transition for boss effects
}
