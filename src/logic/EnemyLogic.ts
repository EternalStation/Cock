import type { GameState, Enemy, ShapeType } from './types';
import { SHAPE_DEFS, PALETTES, PULSE_RATES, SHAPE_CYCLE_ORDER } from './constants';
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
    // Determine Active Colors based on Cycle (0-5m, 5-10m, 10-15m)
    let activeColors: string[];

    if (cycleIndex === 0) {
        // Cycle 1 (0-5m): Bright Core, Dim Inner, Dim Outer
        activeColors = [baseColors[0], baseColors[2], baseColors[2]];
    } else if (cycleIndex === 1) {
        // Cycle 2 (5-10m): Dim Core, Bright Inner, Dim Outer
        activeColors = [baseColors[2], baseColors[0], baseColors[2]];
    } else {
        // Cycle 3 (10-15m): Bright Core, Dim Inner, Bright Outer
        activeColors = [baseColors[0], baseColors[2], baseColors[0]];
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
    // Spawn farther away (1150px - 1250px)
    // User Request: Bosses spawn at 1500px
    const baseDist = isBoss ? 1500 : 1150;
    const d = baseDist + Math.random() * 100;
    const x = player.x + Math.cos(a) * d;
    const y = player.y + Math.sin(a) * d;

    // Scaling
    const cycleCount = Math.floor(gameTime / 300); // Every 5 mins is a full cycle
    const hpMult = Math.pow(1.2, cycleCount) * shapeDef.hpMult;
    const size = isBoss ? 60 : (20 * shapeDef.sizeMult);

    // HP
    // HP Calculation (Exponential Scaling)
    // Base 50, +15% per FULL minute (Step scaling)
    const minutes = gameTime / 60;
    const baseHp = 50 * Math.pow(1.15, Math.floor(minutes));
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


    // Diamond Specific Setup
    let diamondProps = {};
    if (shapeDef.type === 'diamond') {
        const rangeRoll = Math.random();
        let pMin = 500, pMax = 900;
        if (rangeRoll < 0.33) { pMin = 500; pMax = 600; }
        else if (rangeRoll < 0.66) { pMin = 600; pMax = 700; }
        else { pMin = 700; pMax = 900; }

        const intervalRoll = Math.floor(Math.random() * 3); // 0, 1, 2
        const sInterval = (3000 + (intervalRoll * 1000)); // 3000, 4000, 5000

        diamondProps = {
            preferredMinDist: pMin,
            preferredMaxDist: pMax,
            strafeInterval: sInterval
        };
    }

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
        particleOrbit: isBoss ? Math.random() * Math.PI * 2 : 0,

        ...diamondProps
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
        palette: ['#FACC15', '#EAB308', '#CA8A04'], // Phase 1: Yellows (Passive)
        pulsePhase: 0,
        rotationPhase: 0,
        timer: Date.now(),

        // Rare Props
        isRare: true,
        size: 25, // Slightly larger for new shape
        rarePhase: 0, // Phase 1: Passive (Yellow)
        rareTimer: state.gameTime, // Phase start time (Seconds)
        rareIntent: 0,
        rareReal: true,
        canBlock: false, // Only true in Phase 2

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

    // Logic: Spawn every 2 minutes starting at 1:00 (60s)
    // 0: 60s (1:00)
    // 1: 180s (3:00)
    // 2: 300s (5:00)
    // Formula: Threshold = 60 + (Cycle * 120)

    const nextSpawnTime = 60 + (rareSpawnCycle * 120);

    if (gameTime >= nextSpawnTime) {
        spawnRareEnemy(state);
        state.rareSpawnCycle++;
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
    // Base rate increases slowly over time: 1.4 + 0.1 per minute
    const minutes = gameTime / 60;
    const baseSpawnRate = 1.4 + (minutes * 0.1);
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

                        // TELEPORT LOGIC: Mirrored direction behind player at 80% distance
                        const dx = e.x - player.x;
                        const dy = e.y - player.y;

                        // New Position = Player - (VectorToSnitch * 0.8)
                        e.x = player.x - (dx * 0.8);
                        e.y = player.y - (dy * 0.8);

                        // Sfx
                        playSfx('rare-spawn'); // Alert sound

                        // Change Color to Orange for Phase 2
                        e.palette = ['#F97316', '#EF4444', '#F97316']; // Bright Orange Core, Red Inner, Orange Outer
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
                // Timeout (30s Reset)
                if (timeAlive > 30) {
                    e.dead = true;
                    playSfx('rare-despawn');
                    state.rareSpawnActive = false;
                }
            }
            // PHASE 3: AGGRESSIVE / ZIG-ZAG (Both Real and Fake) - 3-WAY FLEE
            // PHASE 3: AGGRESSIVE / SPLIT (Red) - Both Real and Fake rely on this
            else if (e.rarePhase === 2) {
                const timeInPhase3 = state.gameTime - (e.rareTimer || 0);

                // MOVEMENT: Same as Phase 2 (Burst Flee)
                // Cycle: 3s total. 2s Rush, 1s Chill.
                const phaseTime = timeInPhase3 % 3.0;
                const isRushing = phaseTime < 2.0;

                if (isRushing) {
                    const escapeAngle = angleToPlayer + Math.PI;
                    const zagFreq = 8.0;
                    const zagAmp = 1.5;
                    // Mirror Zig-Zag: Real uses 0 offset, Fake uses PI (Inverse)
                    const zagOffset = e.rareReal ? 0 : Math.PI;
                    const zag = Math.sin(timeInPhase3 * zagFreq + zagOffset) * zagAmp;
                    const moveAngle = escapeAngle + zag;
                    const rushSpd = 7.2;

                    e.x += Math.cos(moveAngle) * rushSpd;
                    e.y += Math.sin(moveAngle) * rushSpd;
                } else {
                    const driftAngle = angleToPlayer + Math.PI;
                    e.x += Math.cos(driftAngle) * 1.0;
                    e.y += Math.sin(driftAngle) * 1.0;
                }

                if (!e.phase3AudioTriggered) {
                    playSfx('smoke-puff');
                    e.phase3AudioTriggered = true;
                }

                // Glitch Logic for FAKE
                if (!e.rareReal) {
                    // Start glitching after 2 seconds
                    if (timeInPhase3 > 2.0) {
                        e.glitchPhase = (e.glitchPhase || 0) + 1.0;
                        // Occasional flicker/teleport for visual confusion
                        if (Math.random() > 0.9) {
                            e.x += (Math.random() - 0.5) * 20;
                            e.y += (Math.random() - 0.5) * 20;
                        }
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
            // Chaos Level Calculation: 0.0 at <2 min, 1.0 at >12 min
            // user: Early (min 2/4/6/8/10), Late (min 12/14/16/18/20)
            const minutes = gameTime / 60;
            const chaosLevel = Math.min(1, Math.max(0, (minutes - 2) / 10)); // 0 at 2m, 1 at 12m

            // Speed up phases based on chaos
            e.wobblePhase = (e.wobblePhase || 0) + 0.1 + (chaosLevel * 0.2);
            e.glitchPhase = (e.glitchPhase || 0) + 0.05 + (chaosLevel * 0.1); // flicker speed
            e.crackPhase = (e.crackPhase || 0) + 0.02 + (chaosLevel * 0.05);
            e.particleOrbit = (e.particleOrbit || 0) + 0.05 + (chaosLevel * 0.1);

            // Update trail data (glitchy after-images)
            if (!e.trails) e.trails = [];

            // Trail spawn rate increases with chaos
            // Base: 10% chance per frame. Max Chaos: 50% chance.
            if (Math.random() < 0.1 + (chaosLevel * 0.4)) {
                e.trails.unshift({
                    x: e.x + (Math.random() - 0.5) * (chaosLevel * 20), // Jittery trail pos
                    y: e.y + (Math.random() - 0.5) * (chaosLevel * 20),
                    alpha: 0.6 + (chaosLevel * 0.4), // Brighter trails at high chaos
                    rotation: (e.rotationPhase || 0) + (Math.random() - 0.5) // Random rotation offset
                });
            }

            // Fade trails
            // Early: Fade fast (0.1). Late: Fade slow (0.05) -> More trails on screen
            const fadeRate = 0.1 - (chaosLevel * 0.05);
            e.trails.forEach(t => t.alpha -= fadeRate);
            e.trails = e.trails.filter(t => t.alpha > 0).slice(0, 10 + Math.floor(chaosLevel * 20)); // Limit count

            // Pentagon pulses faster
            if (e.shape === 'pentagon') {
                e.pulsePhase += pulseSpeed * 0.3;
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
                        // Move towards player in spiral
                        // Calculate angle to player
                        const spiralSpeed = 1.125; // Lowered by 25% (was 1.5)
                        const rotationSpeed = 0.0225; // Lowered by 25% (was 0.03)

                        e.spiralAngle = (e.spiralAngle || 0) + rotationSpeed;
                        e.spiralRadius -= spiralSpeed;

                        // Force face player (Arrow Tip)
                        e.rotationPhase = angleToPlayer;

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
                    const pMax = e.preferredMaxDist || 900;
                    const pMin = e.preferredMinDist || 500;
                    const sInt = e.strafeInterval || 3000;

                    // Dodge Mechanic
                    if (Date.now() - (e.timer || 0) > sInt) {
                        // Dodge Phase (Strafing)
                        const strafeAngle = angleToPlayer + (Math.PI / 2 * (e.dodgeDir || 1));
                        e.x += Math.cos(strafeAngle) * diamondSpd * 3.0;
                        e.y += Math.sin(strafeAngle) * diamondSpd * 3.0;

                        if (Date.now() - (e.timer || 0) > (sInt + 500)) { // 0.5s duration
                            e.timer = Date.now();
                            e.dodgeDir = (e.dodgeDir || 1) * -1;
                        }
                    } else {
                        // Kiting Logic: Keep distance
                        if (dist > pMax) {
                            // Approach
                            e.x += Math.cos(angleToPlayer) * diamondSpd;
                            e.y += Math.sin(angleToPlayer) * diamondSpd;
                        } else if (dist < pMin) {
                            // Retreat (Backing up)
                            e.x -= Math.cos(angleToPlayer) * diamondSpd;
                            e.y -= Math.sin(angleToPlayer) * diamondSpd;
                        } else {
                            // In Range: Stop and Shoot (Just fire)
                            // No movement
                        }
                    }

                    // Shoot Logic
                    if (Date.now() - e.lastAttack > 6000) {
                        // Projectile Dmg: Base 20, Grows 50% every 5 minutes (compound)
                        // Cycle count = minutes / 5
                        const cycles = Math.floor((gameTime / 60) / 5);
                        const baseProjDmg = 20;
                        // 1.5 multiplier (50% increase)
                        const projDmg = baseProjDmg * Math.pow(1.5, cycles);

                        spawnEnemyBullet(state, e.x, e.y, angleToPlayer, projDmg, e.palette[0]);
                        e.lastAttack = Date.now();
                    }
                    break;

                case 'pentagon': // Swarm Leader (Summoner)
                    const PENTAGON_ENGAGE_DIST = 700;
                    const PENTAGON_MIN_DIST = 500;
                    const SUMMON_COOLDOWN = 15000;
                    const CAST_DURATION = 4000;

                    // 1. Check Range Init
                    if (!e.reachedRange && dist <= PENTAGON_ENGAGE_DIST) {
                        e.reachedRange = true;
                        // Can Summon immediately upon reaching range? 
                        // User said: "After pentagon reaches ... 700 range ... he now is able to spawn minions."
                        // It doesn't say "immediately", but usually cooldown starts or is ready.
                        // Let's set lastAttack to allow immediate cast or wait?
                        // "Cooldown: Every 15 seconds."
                        // Let's assume he starts fresh, so he can cast soon.
                        e.lastAttack = Date.now() - SUMMON_COOLDOWN; // Ready to cast
                    }

                    // 2. Summon State Logic (Casting)
                    if (e.summonState === 2) {
                        const castTime = Date.now() - (e.timer || 0);

                        // Pulsate Effect (Fast Pulse during cast)
                        e.pulsePhase += 0.2;

                        // Finish Casting?
                        if (castTime > CAST_DURATION) {
                            // SPAWN 5 MINIONS
                            for (let k = 0; k < 5; k++) {
                                // Spawn from 5 corners
                                const cornerAngle = (Math.PI * 2 / 5) * k - (Math.PI / 2); // Align with point up
                                // Add rotation to corner position based on enemy rotation?
                                // Simplified: Just use static relative to center
                                const spawnX = e.x + Math.cos(cornerAngle) * (e.size * 1.5);
                                const spawnY = e.y + Math.sin(cornerAngle) * (e.size * 1.5);

                                // Calc spiral start props
                                const spawnDx = spawnX - player.x;
                                const spawnDy = spawnY - player.y;
                                const startDist = Math.hypot(spawnDx, spawnDy);
                                const startAngle = Math.atan2(spawnDy, spawnDx);

                                const mini: Enemy = {
                                    ...e,
                                    id: Math.random(),
                                    type: 'minion', // Generic type
                                    shape: 'minion', // New Unique Shape
                                    size: 15, // Small
                                    hp: e.maxHp * 0.1, // 10% of Pentagon HP
                                    maxHp: e.maxHp * 0.1,
                                    x: spawnX,
                                    y: spawnY,
                                    boss: false,
                                    summonState: 0,
                                    spd: 2.4 * 1.3, // Fast
                                    dead: false,

                                    // Minion Logic Props
                                    timer: Date.now() + (k * 200), // Stagger activation slightly
                                    spiralRadius: startDist,
                                    spiralAngle: startAngle,
                                    palette: ['#FFD700', '#FFA500', '#FF4500'] // Gold/Orange Fire look for Minions
                                };
                                state.enemies.push(mini);
                            }

                            e.summonState = 0;
                            e.lastAttack = Date.now(); // Reset Cooldown
                        }

                        // Don't move while casting (User: "cant be enterupted by his goal to keep 500-700pxl distance")
                        // Implies he stays put or ignores movement rules.
                        break;
                    }

                    // 3. Normal Behavior

                    // Check Cooldown for Summon
                    // User Request: Only summon during spawn minutes (Min 4, 9, 14, etc - Cycle Index 4)
                    const isPentagonMinute = Math.floor(gameTime / 60) % 5 === 4;

                    if (isPentagonMinute && e.reachedRange && Date.now() - e.lastAttack > SUMMON_COOLDOWN) {
                        e.summonState = 2; // Enter Casting
                        e.timer = Date.now();
                        break; // Stop movement frame to start casting
                    }

                    // Movement Logic
                    if (!e.reachedRange) {
                        // Move directly to player
                        e.x += Math.cos(angleToPlayer) * currentSpd;
                        e.y += Math.sin(angleToPlayer) * currentSpd;
                    } else {
                        // Maintain 500-700
                        if (dist > PENTAGON_ENGAGE_DIST) {
                            // Too far -> Approach
                            e.x += Math.cos(angleToPlayer) * currentSpd;
                            e.y += Math.sin(angleToPlayer) * currentSpd;
                        } else if (dist < PENTAGON_MIN_DIST) {
                            // Too close -> Retreat
                            e.x -= Math.cos(angleToPlayer) * currentSpd;
                            e.y -= Math.sin(angleToPlayer) * currentSpd;
                        } else {
                            // Inside Goldilocks zone (500-700) -> Hold or Strafe?
                            // User said "keep distance", holding is fine.
                            // Maybe slow drift to keep it dynamic
                            e.x += Math.cos(angleToPlayer + Math.PI / 2) * (currentSpd * 0.2);
                            e.y += Math.sin(angleToPlayer + Math.PI / 2) * (currentSpd * 0.2);
                        }
                    }
                    break;
            }
        }
    });
}
