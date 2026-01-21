import type { GameState, Enemy, ShapeType } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SHAPE_DEFS, PALETTES, PULSE_RATES, SHAPE_CYCLE_ORDER } from './constants';
import { spawnEnemyBullet } from './ProjectileLogic';
import { playSfx } from './AudioLogic';



// Helper to determine current game era params
function getProgressionParams(gameTime: number) {
    const minutes = Math.floor(gameTime / 60);
    const eraIndex = Math.floor(minutes / 15);
    const cycleIndex = Math.floor((minutes % 15) / 5); // 0, 1, 2
    const shapeIndex = minutes % 5;

    // Cycle shapes: Circle -> Triangle -> Square -> Diamond -> Pentagon
    const shapeId = SHAPE_CYCLE_ORDER[shapeIndex];
    const shapeDef = SHAPE_DEFS[shapeId];

    // Era Palette (Green -> Blue -> Purple -> Orange -> Red)
    const eraPalette = PALETTES[eraIndex % PALETTES.length];
    const baseColors = eraPalette.colors; // [Bright, Medium, Dark]

    // Determine Active Colors based on Cycle (0-5m, 5-10m, 10-15m)
    let activeColors: string[];

    if (cycleIndex === 0) {
        // Cycle 1: Bright Core, Med Inside, Dark Outline
        activeColors = [baseColors[0], baseColors[1], baseColors[2]];
    } else if (cycleIndex === 1) {
        // Cycle 2: Med Core, Bright Inside, Med Outline
        activeColors = [baseColors[1], baseColors[0], baseColors[1]];
    } else {
        // Cycle 3: Bright Core, Med Inside, Bright Outline
        activeColors = [baseColors[0], baseColors[1], baseColors[0]];
    }

    // Pulse Speed
    const pulseDef = PULSE_RATES.find(p => minutes < p.time) || PULSE_RATES[PULSE_RATES.length - 1];

    return { shapeDef, activeColors, pulseDef };
}

export function spawnEnemy(state: GameState, isBoss: boolean = false) {
    const { player, gameTime } = state;

    const { shapeDef, activeColors } = getProgressionParams(gameTime);

    // Position: Random angle at distance
    const a = Math.random() * 6.28;
    // Spawn farther away to avoid cheap hits
    const d = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.8;
    const x = player.x + Math.cos(a) * d;
    const y = player.y + Math.sin(a) * d;

    // Scaling
    const cycleCount = Math.floor(gameTime / 300); // Every 5 mins is a full cycle
    const hpMult = Math.pow(1.2, cycleCount) * shapeDef.hpMult;
    const size = isBoss ? 60 : (20 * shapeDef.sizeMult);

    // HP
    const baseHp = 40 + (gameTime * 0.5); // Linear time scaling base
    const hp = (isBoss ? baseHp * 15 : baseHp) * hpMult;

    // Colors based on Era and Stage
    // Stage 0: Core Only
    // Stage 1: Core + Inner
    // Stage 2: Core + Inner + Outer
    // Colors Array: [Core, Inner, Outer]
    // Colors Array: [Core, Inner, Outer]
    // Stage 1 (0-5m): Bright Core, Faint Shells (shells hidden or very dark)
    // Stage 2 (5-10m): Dimmer Core, Visible Inner Shell
    // Stage 3 (10-15m): Dim Core, Clear Inner, Brightest Outer Edge


    const newEnemy: Enemy = {
        id: Math.random(),
        type: (isBoss ? 'boss' : shapeDef.type) as 'boss' | ShapeType,
        x, y,
        size,
        hp,
        maxHp: hp,
        spd: 2.4 * shapeDef.speedMult, // Global base speed 2.4
        boss: isBoss,
        bossType: isBoss ? Math.floor(Math.random() * 2) : 0,
        bossAttackPattern: 0,
        dead: false,

        shape: shapeDef.type as ShapeType,
        shellStage: 2,
        palette: activeColors,
        pulsePhase: 0,
        rotationPhase: Math.random() * Math.PI * 2,

        // Init AI timers with some randomness so they don't all act at once
        lastAttack: Date.now() + Math.random() * 2000,
        timer: 0,
        summonState: 0,
        dodgeDir: Math.random() > 0.5 ? 1 : -1,

        // Boss Visual Effects initialization
        wobblePhase: isBoss ? Math.random() * Math.PI * 2 : 0,
        jitterX: isBoss ? 0 : 0,
        jitterY: isBoss ? 0 : 0,
        glitchPhase: isBoss ? Math.random() * Math.PI * 2 : 0,
        crackPhase: isBoss ? Math.random() * Math.PI * 2 : 0,
        particleOrbit: isBoss ? Math.random() * Math.PI * 2 : 0
    };

    state.enemies.push(newEnemy);
}

// --- RARE "QUANTUM FRAME" ENEMY LOGIC ---

export function spawnRareEnemy(state: GameState) {
    const { player } = state;

    // Position: Random angle at safe distance
    const a = Math.random() * 6.28;
    const d = 1150 + Math.random() * 100; // Spawn range 1150-1250px
    const x = player.x + Math.cos(a) * d;
    const y = player.y + Math.sin(a) * d;

    const rareEnemy: Enemy = {
        id: Math.random(),
        type: 'square', // Uses square physics/base stats but custom renderer
        x, y,

        hp: 1, // Special Health Logic
        maxHp: 3,
        spd: 1.5,
        boss: false,
        bossType: 0,
        bossAttackPattern: 0,
        lastAttack: 0,
        dead: false,

        shape: 'snitch',
        shellStage: 2,
        palette: ['#FFD700', '#FF4500', '#00FFFF'], // Gold, Orange-Red, Cyan (Saturated)
        pulsePhase: 0,
        rotationPhase: 0,
        timer: Date.now(),

        // Rare Props
        isRare: true,
        size: 15,
        rarePhase: 0, // Phase 1: Passive
        rareTimer: state.gameTime, // Phase start time (Seconds)
        rareIntent: 0,
        rareReal: true,
        canBlock: true,

        // Visuals
        trails: [],
        longTrail: [{ x, y }],
        wobblePhase: 0
    };

    state.enemies.push(rareEnemy);
    playSfx('rare-spawn'); // SFX!
    state.rareSpawnActive = true;
    console.log("RARE SPAWN: Quantum Frame spawned at", x, y);
}

function manageRareSpawnCycles(state: GameState) {
    const { gameTime, rareSpawnCycle, rareSpawnActive } = state;
    if (rareSpawnActive) return;

    // Cycle Logic: 3m total (2m active, 1m pause)
    const effectiveTime = gameTime;
    const cycleLength = 180;
    const cycleIndex = Math.floor(effectiveTime / cycleLength);
    const timeInCycle = effectiveTime % cycleLength;
    const isWindowActive = timeInCycle < 120;

    if (isWindowActive) {
        if (cycleIndex >= rareSpawnCycle) {
            // Forces spawn at 30s mark for testing
            if (effectiveTime > 30) {
                spawnRareEnemy(state);
                state.rareSpawnCycle = cycleIndex + 1;
            }
        }
    }
}

// Helper to check if player is aiming at target
function checkPlayerIntent(player: any, enemy: Enemy, bullets: any[]): boolean {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1000) return false;

    const recentBullets = bullets.filter(b => !b.isEnemy && b.life > 0.9);
    let aimedShots = 0;
    recentBullets.forEach(b => {
        const toEnemyX = enemy.x - b.x;
        const toEnemyY = enemy.y - b.y;
        const len = Math.hypot(toEnemyX, toEnemyY);
        const nx = toEnemyX / len;
        const ny = toEnemyY / len;

        const bLen = Math.hypot(b.vx, b.vy);
        const bnx = b.vx / bLen;
        const bny = b.vy / bLen;

        const dot = bnx * nx + bny * ny;
        if (dot > 0.9) aimedShots++;
    });

    return aimedShots > 0;
}

export function updateEnemies(state: GameState) {
    const { player, enemies, gameTime } = state;
    const { shapeDef, pulseDef } = getProgressionParams(gameTime);

    // Spawning Logic
    // Base rate increases slowly over time
    const baseSpawnRate = 1.0 + (gameTime / 60) * 0.1;
    // Apply Shape Modifier (Circle spawns more, Pentagon less)
    const actualRate = baseSpawnRate * shapeDef.spawnWeight;

    if (Math.random() < actualRate / 60) {
        spawnEnemy(state, false);
    }

    // Rare Spawning Logic
    manageRareSpawnCycles(state);

    // Boss Spawning
    if (gameTime >= state.nextBossSpawnTime) {
        spawnEnemy(state, true);
        state.nextBossSpawnTime += 120; // 2 Minutes
    }

    // Update Enemies
    enemies.forEach(e => {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy);
        const angleToPlayer = Math.atan2(dy, dx);

        // Pulse Animation
        // interval is in frames (e.g. 300 frames = 5s)
        const pulseSpeed = (Math.PI * 2) / pulseDef.interval;
        e.pulsePhase = (e.pulsePhase + pulseSpeed) % (Math.PI * 2);

        // Rotation Animation (Slow spin)
        e.rotationPhase = (e.rotationPhase || 0) + 0.01;

        // --- RARE ENEMY UPDATE ---
        if (e.isRare) {
            const timeAlive = state.gameTime - (e.rareTimer || state.gameTime);

            // Update Trails (History)
            if (!e.trails) e.trails = [];
            // Add trail every 3 frames approx
            if (state.gameTime % (3 / 60) < 0.02) {
                e.trails.unshift({ x: e.x, y: e.y, alpha: 1.0, rotation: e.wobblePhase || 0 });
                if (e.trails.length > 20) e.trails.pop();
            }
            e.trails.forEach(t => t.alpha -= 0.02);

            // PHASE 1: PASSIVE / WANDER (Orbit)
            if (e.rarePhase === 0) {
                // Circle around player at distance
                const currentAngle = Math.atan2(e.y - player.y, e.x - player.x);
                const nextAngle = currentAngle + (0.005); // Slow orbit

                // Maintain distance band 1150-1250
                let targetDist = Math.hypot(e.x - player.x, e.y - player.y);
                if (targetDist < 1150) targetDist += 2;
                else if (targetDist > 1250) targetDist -= 2;

                e.x = player.x + Math.cos(nextAngle) * targetDist;
                e.y = player.y + Math.sin(nextAngle) * targetDist;

                // Long Paint Trail (Thick Yellow Line)
                if (!e.longTrail) e.longTrail = [];
                // Add point every frame for smooth line
                e.longTrail.push({ x: e.x, y: e.y });
                // Trail stays until Phase 2 starts, so we don't shift/remove elements yet!
                // Unless it gets too long for memory, but user said "stays until phase 2"

                // Activation Condition: Distance < 400 AND Player Looking
                if (dist < 400) {
                    // Check Logic: Player Velocity or Face Angle vs Direction to Enemy
                    // Using player.targetAngle (mouse aim) implies "looking"
                    const toEnemyX = e.x - player.x;
                    const toEnemyY = e.y - player.y;
                    const angleToEnemy = Math.atan2(toEnemyY, toEnemyX);

                    // Difference between look angle and angle to enemy
                    let angleDiff = Math.abs(player.targetAngle - angleToEnemy);
                    // Normalize to -PI..PI
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                    // If looking within ~45 degrees (0.8 rads)
                    if (Math.abs(angleDiff) < 0.8) {
                        e.rarePhase = 1;
                        e.rareTimer = state.gameTime;
                        e.spd = 8; // Burst speed
                        e.teleported = true;
                        e.longTrail = []; // Clear trail on activation

                        // Sfx
                        playSfx('rare-spawn'); // Alert sound
                    }
                }

                // Despawn (60s Reset for Phase 1 - give them time to find it)
                if (timeAlive > 60) {
                    e.dead = true;
                    playSfx('rare-despawn');
                    state.rareSpawnActive = false;
                }
            }
            // PHASE 2: ALERT / BURST FLEE
            else if (e.rarePhase === 1) {
                // Cycle: 3s total. 2s Rush, 1s Chill.
                const phaseTime = timeAlive % 3.0;
                const isRushing = phaseTime < 2.0;

                if (isRushing) {
                    const escapeAngle = angleToPlayer + Math.PI;
                    const zagFreq = 8.0;
                    const zagAmp = 1.5;
                    const zag = Math.sin(timeAlive * zagFreq) * zagAmp;
                    const moveAngle = escapeAngle + zag;
                    const rushSpd = 7.2;

                    e.x += Math.cos(moveAngle) * rushSpd;
                    e.y += Math.sin(moveAngle) * rushSpd;
                } else {
                    const driftAngle = angleToPlayer + Math.PI;
                    e.x += Math.cos(driftAngle) * 1.0;
                    e.y += Math.sin(driftAngle) * 1.0;
                }

                // Defense Check (Wall)
                const now = Date.now();
                if (now - e.lastAttack > 5000 && checkPlayerIntent(player, e, state.bullets)) {
                    const blockX = e.x + Math.cos(angleToPlayer) * 50;
                    const blockY = e.y + Math.sin(angleToPlayer) * 50;

                    for (let i = -2; i <= 2; i++) {
                        const blocker: Enemy = {
                            id: Math.random(),
                            type: 'minion', shape: 'circle',
                            x: blockX + Math.cos(angleToPlayer + Math.PI / 2) * (i * 20),
                            y: blockY + Math.sin(angleToPlayer + Math.PI / 2) * (i * 20),
                            size: 8, hp: 1, maxHp: 1, spd: 0,
                            boss: false, bossType: 0, bossAttackPattern: 0, lastAttack: 0, dead: false,
                            shellStage: 0, palette: ['#06b6d4', '#fff', '#fff'], pulsePhase: 0, rotationPhase: 0, timer: now + 2000,
                            isRare: false, untargetable: true
                        };
                        state.enemies.push(blocker);
                    }
                    e.lastAttack = now;
                }

                // Timeout (30s Reset)
                if (timeAlive > 30) {
                    e.dead = true;
                    playSfx('rare-despawn');
                    state.rareSpawnActive = false;
                }
            }
            // PHASE 3: PANIC / SPLIT (Activated by Hit)
            else if (e.rarePhase === 2) {
                // Movement: Panic running away
                e.spd = 6.0;
                e.x -= Math.cos(angleToPlayer) * e.spd;
                e.y -= Math.sin(angleToPlayer) * e.spd;

                // Glitch Logic for FAKE
                if (!e.rareReal) {
                    const timeInPhase3 = state.gameTime - (e.rareTimer || 0);
                    if (timeInPhase3 > 3.0) {
                        e.glitchPhase = (e.glitchPhase || 0) + 1.0;
                    }
                }

                if (timeAlive > 60) {
                    e.dead = true;
                    if (e.rareReal) {
                        state.rareSpawnActive = false;
                    }
                }
            }

            return; // Skip normal behavior
        }

        // Boss visual effects update
        if (e.boss) {
            e.wobblePhase = (e.wobblePhase || 0) + 0.1;
            e.glitchPhase = (e.glitchPhase || 0) + 0.5;
            e.crackPhase = (e.crackPhase || 0) + 0.1;
            e.particleOrbit = (e.particleOrbit || 0) + 0.1;

            // Update trail data (glitchy after-images)
            if (!e.trails) e.trails = [];
            // Add new trail segment every few frames
            if (Math.random() > 0.7) {
                e.trails.unshift({ x: e.x, y: e.y, alpha: 0.5, rotation: e.wobblePhase * 0.7 });
            }
            // Fade and remove old trails
            e.trails.forEach(t => t.alpha -= 0.05);
            e.trails = e.trails.filter(t => t.alpha > 0).slice(0, 5);

            // Pentagon pulses faster
            if (e.shape === 'pentagon') {
                e.pulsePhase += pulseSpeed * 0.3; // 30% faster pulse
            }

            // Basic Boss Movement
            e.x += Math.cos(angleToPlayer) * e.spd;
            e.y += Math.sin(angleToPlayer) * e.spd;
        } else {
            // Apply Speed Modifiers
            // Circle gets +50% baseline
            let currentSpd = e.spd;
            if (e.shape === 'circle') currentSpd *= 1.5;

            switch (e.shape) {
                case 'circle': // Chaser
                case 'minion': // Pentagon-spawned minion (behaves like circle)
                    // Minion Wait Logic (if timer set)
                    if (e.timer && Date.now() < e.timer) {
                        return; // Wait until activation
                    }

                    // Spiral / Black Hole Logic for Minions
                    if (e.spiralRadius && e.spiralRadius > 10) {
                        // Move towards player in spiral
                        // Calculate angle to player
                        const spiralSpeed = 1.5; // 70% Speed (~1.5)
                        const rotationSpeed = 0.03; // Slow spin

                        e.spiralAngle = (e.spiralAngle || 0) + rotationSpeed;
                        e.spiralRadius -= spiralSpeed;

                        // Use pure spiral angle for smooth orbit
                        e.x = player.x + Math.cos(e.spiralAngle) * e.spiralRadius;
                        e.y = player.y + Math.sin(e.spiralAngle) * e.spiralRadius;

                        // Safety: if too close, switch to normal chase
                        if (e.spiralRadius < 20) e.spiralRadius = 0;
                    } else {
                        e.x += Math.cos(angleToPlayer) * currentSpd;
                        e.y += Math.sin(angleToPlayer) * currentSpd;
                    }
                    break;

                case 'triangle': // Charger
                    // Logic: Wait 5s, then Dash
                    if (!e.timer) e.timer = Date.now();

                    if (Date.now() - e.lastAttack > 5000) {
                        // Dash!
                        e.spd = 18; // Increased from 12 (1.5x bigger dash effect)
                        e.lastAttack = Date.now();
                    }

                    // Friction
                    const baseTriSpd = 1.7 * SHAPE_DEFS['triangle'].speedMult;
                    if (e.spd > baseTriSpd) {
                        e.spd *= 0.90; // Decelerate
                    } else {
                        e.spd = baseTriSpd;
                    }

                    e.x += Math.cos(angleToPlayer) * e.spd;
                    e.y += Math.sin(angleToPlayer) * e.spd;
                    break;

                case 'square': // Tank - slow, steady
                    e.x += Math.cos(angleToPlayer) * currentSpd;
                    e.y += Math.sin(angleToPlayer) * currentSpd;
                    break;

                case 'diamond': // Sniper + Dodge
                    // Speed Boost (x1.2 from base)
                    const diamondSpd = currentSpd * 1.2;

                    // Dodge Mechanic: Every 5s -> Faster Dodge
                    if (Date.now() - (e.timer || 0) > 3000) {
                        // Dodge Phase (Strafing)
                        const strafeAngle = angleToPlayer + (Math.PI / 2 * (e.dodgeDir || 1));
                        e.x += Math.cos(strafeAngle) * diamondSpd * 3.0;
                        e.y += Math.sin(strafeAngle) * diamondSpd * 3.0;

                        if (Date.now() - (e.timer || 0) > 3500) {
                            e.timer = Date.now();
                            e.dodgeDir = (e.dodgeDir || 1) * -1;
                        }
                    } else {
                        // Kiting Logic: Keep distance 500-900px
                        if (dist > 900) {
                            // Approach
                            e.x += Math.cos(angleToPlayer) * diamondSpd;
                            e.y += Math.sin(angleToPlayer) * diamondSpd;
                        } else if (dist < 500) {
                            // Retreat (Backing up)
                            e.x -= Math.cos(angleToPlayer) * diamondSpd;
                            e.y -= Math.sin(angleToPlayer) * diamondSpd;
                        } else {
                            // In Range: Stop and Shoot (Just fire)
                            // No movement
                        }
                    }

                    // Shoot Logic
                    if (Date.now() - e.lastAttack > 3000) {
                        spawnEnemyBullet(state, e.x, e.y, angleToPlayer, 20, e.palette[0]);
                        e.lastAttack = Date.now();
                    }
                    break;

                case 'pentagon': // Swarm Leader
                    // 1. Check if just spawned (not seen yet)
                    if (!e.seen) {
                        if (dist < 1000) {
                            e.seen = true;
                            e.timer = Date.now(); // Start 3s initial wait
                            e.lastAttack = Date.now() + 3000; // First summon after 3s
                        }
                        // Normal move while unseen
                        if (dist > 200) {
                            e.x += Math.cos(angleToPlayer) * currentSpd;
                            e.y += Math.sin(angleToPlayer) * currentSpd;
                        }
                        break;
                    }

                    // 2. Summon Logic (15s cooldown)
                    if (Date.now() - e.lastAttack > 15000) {
                        // Start Summon (go straight to casting, no pause)
                        e.summonState = 2;
                        e.timer = Date.now();
                        e.lastAttack = Date.now(); // Reset CD
                    }

                    if (e.summonState === 2) {
                        // Casting (1 minute duration)
                        if (Date.now() - (e.timer || 0) > 1000) {
                            // SPAWN 5 CIRCLES!
                            const dx = e.x - player.x;
                            const dy = e.y - player.y;
                            const startDist = Math.hypot(dx, dy);
                            const startAngle = Math.atan2(dy, dx);

                            for (let k = 0; k < 5; k++) {
                                // Spawn from 5 corners
                                const cornerAngle = (Math.PI * 2 / 5) * k;
                                const spawnX = e.x + Math.cos(cornerAngle) * (e.size + 15);
                                const spawnY = e.y + Math.sin(cornerAngle) * (e.size + 15);

                                const mini: Enemy = {
                                    ...e,
                                    id: Math.random(),
                                    type: 'minion',
                                    shape: 'minion', // Fully distinct shape type
                                    size: 13, // 1.04x size (0.8 * 1.3 base, scaled to ~13)
                                    hp: e.hp * 0.3,
                                    x: spawnX,
                                    y: spawnY,
                                    boss: false,
                                    summonState: 0,
                                    spd: 2.4 * 1.3, // Match global speed * circle mult
                                    dead: false,

                                    // Sequential activation: 0.4s intervals
                                    timer: Date.now() + (k * 400),

                                    // Spiral Props
                                    spiralRadius: startDist,
                                    spiralAngle: startAngle
                                };
                                state.enemies.push(mini);
                            }

                            e.summonState = 0; // Resume normal behavior
                        }
                    } else {
                        // Chase Behavior (maintain distance)
                        if (dist > 400) {
                            e.x += Math.cos(angleToPlayer) * currentSpd;
                            e.y += Math.sin(angleToPlayer) * currentSpd;
                        } else if (dist < 300) {
                            e.x -= Math.cos(angleToPlayer) * currentSpd;
                            e.y -= Math.sin(angleToPlayer) * currentSpd;
                        }
                    }
                    break;
            }
        }
    });
}
