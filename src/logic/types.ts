export type Vector = { x: number; y: number };

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
    type?: 'shard' | 'spark';
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
    knockback: Vector;
    stunnedUntil?: number; // Timestamp when stun ends
    invincibleUntil?: number; // Timestamp for invincibility (e.g. Ninja Smoke)
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
    size: number;
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
    spawnedAt?: number; // GameTime when spawned

    // Snitch AI Props
    // Snitch AI Props
    charge?: number; // For Snitch Phase 2 Charge Mechanic

    // Custom Collision Props
    customCollisionDmg?: number; // If set, overrides standard 15% damage
    stunOnHit?: boolean; // If true, stuns player on collision

    // XP Reward
    xpRewardMult?: number; // Multiplier for XP gain (overrides isElite check if present)
    mergeState?: 'none' | 'warming_up' | 'merging';
    mergeId?: string; // Group ID for merging cluster
    mergeTimer?: number; // Timestamp when merge completes
    mergeHost?: boolean; // Is this the "host" that becomes elite?
    mergeCooldown?: number; // Cooldown timestamp before can merge again (after failed merge)

    // Elite Properties
    isElite?: boolean;
    eliteState?: number; // For elite skills (0=Ready, 1=Active...)
    originalPalette?: string[]; // Store original palette before ability color changes
    lockedTargetX?: number; // For Circle Elite bull charge - locked player X position
    lockedTargetY?: number; // For Circle Elite bull charge - locked player Y position


    // Physics / Status
    frozen?: number; // Timer for frozen state
    knockback: { x: number; y: number }; // Knockback vector
    shieldCd?: number; // For Snitch bullet stoppers (barrels)
    hideCd?: number; // Cooldown for hiding behind enemies
    hideTarget?: Vector | null; // Persist target for CD alignment
    hideCoverId?: number; // ID of the enemy we are currently hiding behind
    tacticalMode?: number; // 0 = Hide, 1 = Avoid
    tacticalTimer?: number; // Timestamp for mode switching
    laserTick?: number; // Timestamp for last laser damage tick (Diamond Elite)
    dodgeCooldown?: number; // Escape dash timer for diamonds
    lastDodge?: number; // Last escape dash timestamp (cooldown tracking)
    lastBarrierTime?: number; // Timestamp when Barrels (Shields) were last used
    lastCollisionDamage?: number; // Timestamp for last collision damage dealt to player
    smokeRushEndTime?: number; // Timestamp when smoke rush ends
    hidingStateEndTime?: number; // Timestamp when hiding behavior ends
    isNeutral?: boolean; // If true, ignored by auto-aim (e.g. Barrels)
    baseColor?: string; // Immutable spawn color for projectiles
    spiralDelay?: number; // Delay in seconds before starting spiral motion (Minions)


    // Minion / Pentagon Guard Props
    minionState?: number; // 0=Orbit, 1=Attack
    orbitAngle?: number;
    orbitDistance?: number;
    lastLaunchTime?: number; // Mother's launch throttle
    suicideTimer?: number; // Mother's delayed explosion
    triggeredLaunchTime?: number; // Timestamp of proximity trigger
    angryUntil?: number; // End time for "Angry" red visual
    panicTimer?: number; // Speed boost duration for Real Snitch escape
    panicCooldown?: number; // Cooldown for panic escape
    trollTimer?: number; // Stop duration for Fake Snitch
    trollRush?: boolean; // If true, Fake Snitch is suicide rushing wall
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
    bossKills: number; // Track boss kills separately
    gameTime: number;
    frameCount: number; // For throttling particle effects
    isPaused: boolean;
    gameOver: boolean;
    nextBossSpawnTime: number;
    playerPosHistory?: { x: number; y: number; timestamp: number }[]; // Last 60 positions for laser prediction
    nextBossId: number; // To track waves
    rareSpawnCycle: number; // Index of rare spawn cycle
    rareSpawnActive: boolean; // Is a rare enemy currently alive?
    rareRewardActive?: boolean; // Flag to show "Increased Rarity" text on next level up
    spawnTimer: number; // For start/restart animation
    hasPlayedSpawnSound?: boolean;
    bossPresence: number; // 0 to 1 smooth transition for boss effects
    smokeBlindTime?: number; // Timestamp for full-screen white fog effect
    spatialGrid: import('./SpatialGrid').SpatialGrid;

    // Portal / Multiverse Props
    currentArena: number; // ID of the arena the player is currently in
    portalState: 'closed' | 'warn' | 'open' | 'transferring';
    portalTimer: number; // Cycles every 4 minutes (240s)
    portalOpenDuration: number; // 10s
    transferTimer: number; // 3s delay during teleport
    nextArenaId: number | null; // Destination
}
