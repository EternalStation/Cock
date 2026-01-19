import type { GameState, Enemy, ShapeType } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SHAPE_DEFS, PALETTES, PULSE_RATES, SHAPE_CYCLE_ORDER } from './constants';
import { spawnEnemyBullet } from './ProjectileLogic';

// Helper to adjust color brightness
function adjustBrightness(hex: string, percent: number) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Helper to determine current game era params
function getProgressionParams(gameTime: number) {
    const minutes = Math.floor(gameTime / 60);
    const eraIndex = Math.floor(minutes / 15);
    const stageIndex = Math.floor((minutes % 15) / 5); // 0, 1, 2 (Core, Inner, Outer)
    const shapeIndex = minutes % 5;

    // Cycle shapes: Circle -> Triangle -> Square -> Diamond -> Pentagon
    const shapeId = SHAPE_CYCLE_ORDER[shapeIndex];
    const shapeDef = SHAPE_DEFS[shapeId];

    // Palette: Cycle through defined palettes, loop if game goes super long
    const paletteDef = PALETTES[eraIndex % PALETTES.length];

    // Pulse Speed
    const pulseDef = PULSE_RATES.find(p => minutes < p.time) || PULSE_RATES[PULSE_RATES.length - 1];

    return { shapeDef, paletteDef, stageIndex, pulseDef };
}

export function spawnEnemy(state: GameState, isBoss: boolean = false) {
    const { player, gameTime } = state;

    const { shapeDef, paletteDef, stageIndex } = getProgressionParams(gameTime);

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
    const baseColors = [...paletteDef.colors];

    if (stageIndex === 1) { // 5-10m (Stage 2 in User Terms)
        baseColors[0] = adjustBrightness(baseColors[0], -20); // Dim Core
    } else if (stageIndex >= 2) { // 10m+ (Stage 3 in User Terms)
        baseColors[0] = adjustBrightness(baseColors[0], -40); // Dimmer Core
        baseColors[1] = adjustBrightness(baseColors[1], -20); // Dim Inner
        // Outer is default bright
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
        dead: false,

        shape: shapeDef.type,
        shellStage: stageIndex,
        palette: baseColors,
        pulsePhase: 0,

        // Init AI timers with some randomness so they don't all act at once
        lastAttack: Date.now() + Math.random() * 2000,
        timer: 0,
        summonState: 0,
        dodgeDir: Math.random() > 0.5 ? 1 : -1
    };

    state.enemies.push(newEnemy);
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

        // Behavior State Machine
        if (e.boss) {
            // Basic Boss Movement
            e.x += Math.cos(angleToPlayer) * e.spd;
            e.y += Math.sin(angleToPlayer) * e.spd;
            // Boss attacks handled separately or can be added here
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
