import type { GameState, Enemy, ShapeType, Vector } from './types';
import { SHAPE_DEFS, PALETTES, PULSE_RATES, SHAPE_CYCLE_ORDER } from './constants';
import { isInMap, getArenaIndex, getRandomPositionInArena } from './MapLogic';
import { spawnEnemyBullet } from './ProjectileLogic';
import { playSfx } from './AudioLogic';


// Helper to determine current game era params
function getProgressionParams(gameTime: number) {
    const minutes = Math.floor(gameTime / 60);
    const eraIndex = Math.floor(minutes / 15);
    const cycleIndex = Math.floor((minutes % 15) / 5);
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

export function updateEnemies(state: GameState) {
    const { enemies, player, gameTime } = state;
    const { shapeDef, pulseDef } = getProgressionParams(gameTime);

    // Spawning Logic
    const minutes = gameTime / 60;
    const baseSpawnRate = 1.4 + (minutes * 0.1);
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

    enemies.forEach(e => {
        if (e.frozen && e.frozen > 0) {
            e.frozen -= 1 / 60;
            return;
        }

        // Knockback handling
        if (e.knockback && (e.knockback.x !== 0 || e.knockback.y !== 0)) {
            e.x += e.knockback.x;
            e.y += e.knockback.y;
            e.knockback.x *= 0.9;
            e.knockback.y *= 0.9;
            if (Math.abs(e.knockback.x) < 0.1) e.knockback.x = 0;
            if (Math.abs(e.knockback.y) < 0.1) e.knockback.y = 0;
            return;
        }

        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy);

        let speed = e.spd; // FIXED: Using 'spd' instead of 'speed'

        // Snitch Logic (Phase 0 handled in switch)
        if (e.isRare && e.rarePhase === 0) {
            // No return here anymore, fall through to switch
        }

        // Separator
        let pushX = 0;
        let pushY = 0;
        enemies.forEach(other => {
            if (e === other) return;
            const odx = e.x - other.x;
            const ody = e.y - other.y;
            const odist = Math.hypot(odx, ody);
            if (odist < e.size * 2) {
                pushX += (odx / odist) * 0.5;
                pushY += (ody / odist) * 0.5;
            }
        });

        // Basic Tracking (Overridden by behaviors below)
        let vx = (dx / dist) * speed + pushX;
        let vy = (dy / dist) * speed + pushY;

        // Apply Speed Modifiers
        let currentSpd = e.spd;
        if (e.shape === 'circle') currentSpd *= 1.5;

        // --- BEHAVIOR OVERRIDES ---
        switch (e.shape) {
            case 'circle':
            case 'minion':
                if (e.timer && Date.now() < e.timer) return;

                if (e.spiralRadius && e.spiralRadius > 10) {
                    const angleToPlayer = Math.atan2(dy, dx);
                    const spiralSpeed = 1.125;
                    const rotationSpeed = 0.0225;
                    e.spiralAngle = (e.spiralAngle || 0) + rotationSpeed;
                    e.spiralRadius -= spiralSpeed;
                    e.rotationPhase = angleToPlayer;
                    // Set Velocity implicitly by setting Position
                    const tx = player.x + Math.cos(e.spiralAngle) * e.spiralRadius;
                    const ty = player.y + Math.sin(e.spiralAngle) * e.spiralRadius;
                    vx = tx - e.x;
                    vy = ty - e.y;
                    if (e.spiralRadius < 20) e.spiralRadius = 0;
                } else {
                    // Standard tracking + swarm
                    const angleToPlayer = Math.atan2(dy, dx);
                    vx = Math.cos(angleToPlayer) * currentSpd + pushX;
                    vy = Math.sin(angleToPlayer) * currentSpd + pushY;
                }
                break;
            case 'triangle':
                if (!e.timer) e.timer = Date.now();
                if (Date.now() - e.lastAttack > 5000) {
                    e.spd = 18;
                    e.lastAttack = Date.now();
                }
                const baseTriSpd = 1.7 * SHAPE_DEFS['triangle'].speedMult;
                if (e.spd > baseTriSpd) e.spd *= 0.90;
                else e.spd = baseTriSpd;

                const angleToPlayerT = Math.atan2(dy, dx);
                vx = Math.cos(angleToPlayerT) * e.spd + pushX;
                vy = Math.sin(angleToPlayerT) * e.spd + pushY;
                break;
            case 'square':
                const angleToPlayerS = Math.atan2(dy, dx);
                vx = Math.cos(angleToPlayerS) * currentSpd + pushX;
                vy = Math.sin(angleToPlayerS) * currentSpd + pushY;
                break;
            case 'diamond':
                // Diamond AI: Kiting Brain (500-900px)
                const angleToPlayerD = Math.atan2(dy, dx);
                // Dynamic distance goal: keep between 500 and 900
                let distGoal = 700;
                if (dist < 500) distGoal = 800; // Back off
                if (dist > 900) distGoal = 600; // Close in

                // Randomized Dodge (3-5s)
                if (!e.timer || Date.now() > e.timer) {
                    e.dodgeDir = Math.random() > 0.5 ? 1 : -1;
                    e.timer = Date.now() + 3000 + Math.random() * 2000;
                }

                const strafeAngle = angleToPlayerD + (e.dodgeDir || 1) * Math.PI / 2;
                const distFactor = (dist - distGoal) / 100;

                vx = Math.cos(strafeAngle) * currentSpd + Math.cos(angleToPlayerD) * distFactor * currentSpd;
                vy = Math.sin(strafeAngle) * currentSpd + Math.sin(angleToPlayerD) * distFactor * currentSpd;

                if (Date.now() - (e.lastAttack || 0) > 6000) {
                    // Scaling: Base 20, +50% every 5m
                    const minutes = state.gameTime / 60;
                    const dmgMult = 1 + (Math.floor(minutes / 5) * 0.5);
                    const finalDmg = 20 * dmgMult;

                    spawnEnemyBullet(state, e.x, e.y, angleToPlayerD, finalDmg, e.palette[0]);
                    e.lastAttack = Date.now();
                }
                break;
            case 'pentagon':
                const age = state.gameTime - (e.spawnedAt || 0);
                const isSummonerPhase = age < 60;

                if (isSummonerPhase) {
                    // SUMMONER PHASE: 15s Cooldown, 5s Cast
                    const timeSinceLast = Date.now() - (e.lastAttack || 0);

                    // Ability Ready? Start pulsating/stationary
                    if (timeSinceLast > 15000) {
                        e.summonState = 2; // Cast State
                        e.timer = (e.timer || 0) + 1; // Increment cast tick

                        // Pulsate Visual: Intense breathing
                        e.pulsePhase = (e.pulsePhase + 0.3) % (Math.PI * 2);

                        vx = 0; vy = 0; // Frozen during cast

                        // Finish Cast (approx 5s at 60fps = 300 ticks)
                        if (e.timer >= 300) {
                            // SPAWN 3 MINIONS
                            for (let i = 0; i < 3; i++) {
                                spawnMinion(state, e);
                            }
                            e.lastAttack = Date.now();
                            e.timer = 0;
                            e.summonState = 0;
                        }
                    } else {
                        // Normal Chase while on Cooldown
                        const angleToPlayerP = Math.atan2(dy, dx);
                        vx = Math.cos(angleToPlayerP) * currentSpd;
                        vy = Math.sin(angleToPlayerP) * currentSpd;
                    }
                } else {
                    // SUICIDE MODE: Aggressive tracking, no spawn
                    const angleToPlayerP = Math.atan2(dy, dx);
                    vx = Math.cos(angleToPlayerP) * (currentSpd * 1.5) + pushX;
                    vy = Math.sin(angleToPlayerP) * (currentSpd * 1.5) + pushY;
                    e.palette = ['#FF4444', '#990000', '#660000']; // Visual transition to aggressive red
                }
                break;
            case 'minion':
                // Spiral around player
                if (e.spiralAngle === undefined) e.spiralAngle = Math.atan2(e.y - player.y, e.x - player.x);
                if (e.spiralRadius === undefined) e.spiralRadius = dist;

                e.spiralAngle += 0.05; // orbit
                e.spiralRadius -= 1.5; // spiral in

                const targetX = player.x + Math.cos(e.spiralAngle) * e.spiralRadius;
                const targetY = player.y + Math.sin(e.spiralAngle) * e.spiralRadius;

                vx = targetX - e.x;
                vy = targetY - e.y;

                if (e.spiralRadius < 20) {
                    // Too close? Just hit
                    const angle = Math.atan2(dy, dx);
                    vx = Math.cos(angle) * currentSpd;
                    vy = Math.sin(angle) * currentSpd;
                }
                break;
            case 'snitch':
                // PER-PHASE TIMEOUT: 30 Seconds
                const timeInPhase = state.gameTime - (e.rareTimer || e.spawnedAt || 0);
                if (timeInPhase > 30) {
                    e.dead = true;
                    state.rareSpawnActive = false;
                    playSfx('rare-despawn');
                    return;
                }

                if (e.rarePhase === 0) {
                    // PHASE 1: STEALTH STALKING (YELLOW)
                    const targetSpd = player.speed * 0.8; // 0.8x player (was 0.3)
                    e.spd = targetSpd;

                    // Drift around player
                    if (e.spiralAngle === undefined) e.spiralAngle = Math.atan2(e.y - player.y, e.x - player.x);
                    e.spiralAngle += 0.005; // slow drift

                    const orbitDist = 1100;
                    let tx = player.x + Math.cos(e.spiralAngle) * orbitDist;
                    let ty = player.y + Math.sin(e.spiralAngle) * orbitDist;

                    // GLOBAL 600px WALL BUFFER - Orbit Safety
                    const wallBuffer = 600;
                    for (let i = 0; i < 5; i++) {
                        // Check if the actual orbit point OR the path to it is too close to void
                        if (!isInMap(tx + Math.cos(e.spiralAngle) * wallBuffer, ty + Math.sin(e.spiralAngle) * wallBuffer) || !isInMap(tx, ty)) {
                            tx -= (tx - player.x) * 0.2;
                            ty -= (ty - player.y) * 0.2;
                        } else {
                            break;
                        }
                    }

                    const tdx = tx - e.x;
                    const tdy = ty - e.y;
                    const tdist = Math.hypot(tdx, tdy);

                    if (tdist > 1) {
                        vx = (tdx / tdist) * e.spd;
                        vy = (tdy / tdist) * e.spd;
                    } else {
                        vx = 0; vy = 0;
                    }

                    // REVEAL TRIGGER: Pure Proximity (< 400px)
                    if (dist < 400) {
                        // TRIGGER PHASE 2
                        e.rarePhase = 1;
                        e.rareTimer = state.gameTime; // RESET TIMER
                        e.palette = ['#f97316', '#ea580c', '#c2410c']; // Orange shift
                        e.longTrail = []; // Clear trail

                        // TELEPORT BEHIND PLAYER (400px)
                        const backAngle = player.faceAngle + Math.PI;
                        e.x = player.x + Math.cos(backAngle) * 400;
                        e.y = player.y + Math.sin(backAngle) * 400;

                        playSfx('rare-spawn'); // Re-ping for activation
                    }

                    if (!e.longTrail) e.longTrail = [];
                    e.longTrail.push({ x: e.x, y: e.y });
                    if (e.longTrail.length > 1000) e.longTrail.shift();

                } else {
                    // PHASE 2 & 3: BAIT & ESCAPE (ORANGE/RED)
                    // TACTICAL LOOP: 3s Hide / 3s Avoid
                    if (e.tacticalTimer === undefined) e.tacticalTimer = state.gameTime;
                    if (state.gameTime - (e.tacticalTimer || 0) > 3) {
                        e.tacticalMode = (e.tacticalMode === 1 ? 0 : 1); // 0 = Hide, 1 = Avoid
                        e.tacticalTimer = state.gameTime;
                    }
                    const isAvoiding = e.tacticalMode === 1;
                    let targetSpd = 0;
                    if (e.rarePhase === 2) {
                        // PHASE 3: AGGRESSIVE SPLIT (1.1x Player Speed)
                        targetSpd = player.speed * 1.1;
                    } else {
                        // PHASE 2: TACTICAL LOOP (Avoid=1.0x, Hide=1.5x)
                        const isAvoiding = e.tacticalMode === 1;
                        targetSpd = isAvoiding ? player.speed : player.speed * 1.5;
                    }
                    e.spd = targetSpd;

                    // 1. Hide behind OTHER enemies (Dynamic ID Tracking)
                    if (isAvoiding) {
                        e.hideCoverId = undefined;
                        e.hideTarget = null;
                    } else if (!e.hideCd || Date.now() > e.hideCd || !e.hideCoverId) {
                        let bestCover: Enemy | null = null;
                        let bestScore = -Infinity;

                        enemies.forEach((other: Enemy) => {
                            if (other === e || other.shape === 'snitch' || other.dead || (other.spd !== undefined && other.spd === 0)) return;
                            const dToOther = Math.hypot(e.x - other.x, e.y - other.y);
                            if (dToOther < 1200) {
                                const angleToOther = Math.atan2(other.y - player.y, other.x - player.x);
                                const angleToSnitch = Math.atan2(e.y - player.y, e.x - player.x);
                                const dot = Math.cos(angleToOther - angleToSnitch);
                                if (dot > 0.85 && dot > bestScore) {
                                    bestScore = dot;
                                    bestCover = other;
                                }
                            }
                        });

                        if (bestCover !== null) {
                            const actualCover: Enemy = bestCover;
                            e.hideCoverId = actualCover.id;
                            e.hideCd = Date.now() + 5000;
                        } else {
                            e.hideCoverId = undefined;
                            e.hideTarget = null;
                        }
                    }

                    // Update Hide Target dynamically based on Cover Enemy's position
                    if (e.hideCoverId && !isAvoiding) {
                        const cover = enemies.find(en => en.id === e.hideCoverId && !en.dead);
                        if (cover) {
                            const distPE = Math.hypot(cover.x - player.x, cover.y - player.y);
                            const dirX = (cover.x - player.x) / distPE;
                            const dirY = (cover.y - player.y) / distPE;
                            e.hideTarget = { x: cover.x + dirX * 100, y: cover.y + dirY * 100 };
                        } else {
                            e.hideCoverId = undefined;
                            e.hideTarget = null;
                        }
                    }

                    // HIDING MOVEMENT (Proportional Drift Smoothing)
                    const fearAngle = Math.atan2(e.y - player.y, e.x - player.x);
                    const zigZag = Math.sin(Date.now() / 200) * 0.8;
                    let hideAngle = fearAngle + zigZag;

                    if (e.hideTarget) {
                        const target = e.hideTarget as Vector;
                        const dxT = target.x - e.x;
                        const dyT = target.y - e.y;
                        const distToTarget = Math.hypot(dxT, dyT);

                        if (distToTarget > 5) {
                            // Smooth pull towards target shadow
                            hideAngle = Math.atan2(dyT, dxT);
                        } else {
                            // Hold position relative to player fear
                            hideAngle = fearAngle;
                        }
                    }
                    let moveAngle = hideAngle;

                    // Wall Avoidance ( GLOBAL 600px SAFETY PROBE )
                    const probeDist = 600;
                    let foundPath = false;
                    for (let offset = 0; offset <= Math.PI; offset += 0.15) {
                        const angles = offset === 0 ? [moveAngle] : [moveAngle + offset, moveAngle - offset];
                        for (const ang of angles) {
                            const testX = e.x + Math.cos(ang) * probeDist;
                            const testY = e.y + Math.sin(ang) * probeDist;
                            if (isInMap(testX, testY)) {
                                moveAngle = ang;
                                foundPath = true;
                                break;
                            }
                        }
                        if (foundPath) break;
                    }

                    vx = Math.cos(moveAngle) * e.spd;
                    vy = Math.sin(moveAngle) * e.spd;

                    // SPEED DAMPING (Shadow Docking)
                    // If we are heading to a hide target and getting close, slow down to avoid shaking
                    if (e.hideTarget) {
                        const target = e.hideTarget as Vector;
                        const distToT = Math.hypot(target.x - e.x, target.y - e.y);
                        if (distToT < 20) {
                            const damp = distToT / 20;
                            vx *= damp;
                            vy *= damp;
                        }
                    }

                    // 2. Spawn Bullet Stoppers (Barrels) on 5s CD if targeted
                    if (!e.shieldCd || Date.now() > e.shieldCd) {
                        const angFromP = Math.atan2(e.y - player.y, e.x - player.x);
                        const angleDiff = Math.abs(((angFromP - player.targetAngle + Math.PI + (Math.PI * 2)) % (Math.PI * 2)) - Math.PI);

                        if (dist < 600 && angleDiff < 0.3) {
                            // SPAWN 5 SHIELDS
                            for (let i = 0; i < 5; i++) {
                                spawnShield(state, e.x + (Math.random() - 0.5) * 40, e.y + (Math.random() - 0.5) * 40);
                            }
                            e.shieldCd = Date.now() + 8000;
                        }
                    }

                    // Add some jitter
                    e.x += (Math.random() - 0.5) * 1;
                    e.y += (Math.random() - 0.5) * 1;
                }
                break;
        }

        // --- WALL COLLISION CHECK ---
        const nextX = e.x + vx;
        const nextY = e.y + vy;

        if (isInMap(nextX, nextY)) {
            e.x = nextX;
            e.y = nextY;
        } else {
            // Hit Wall
            // Attempt Slide
            if (isInMap(nextX, e.y)) {
                e.x = nextX;
                e.y += (Math.random() - 0.5) * 2; // Shake
            } else if (isInMap(e.x, nextY)) {
                e.y = nextY;
                e.x += (Math.random() - 0.5) * 2;
            } else {
                // Bounce / Stop
                e.x -= vx * 0.5;
                e.y -= vy * 0.5;
            }
        }

        // Visual Updates
        const pulseSpeed = (Math.PI * 2) / pulseDef.interval;
        e.pulsePhase = (e.pulsePhase + pulseSpeed) % (Math.PI * 2);
        e.rotationPhase = (e.rotationPhase || 0) + 0.01;

        // --- GLOBAL DEATH SAFETY ---
        if (e.hp <= 0 && !e.dead) {
            e.dead = true;
        }
    });
}

function spawnEnemy(state: GameState, isBoss: boolean = false) {
    const { player, gameTime } = state;
    const { shapeDef, activeColors } = getProgressionParams(gameTime);

    // NEW LOGIC: Spawn in Player's Arena Only
    const playerArena = getArenaIndex(player.x, player.y);
    let spawnPos = { x: player.x, y: player.y };
    let found = false;

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

    const { x, y } = spawnPos;

    // Scaling
    const cycleCount = Math.floor(gameTime / 300);
    const hpMult = Math.pow(1.2, cycleCount) * shapeDef.hpMult;
    const size = isBoss ? 60 : (20 * shapeDef.sizeMult);
    const minutes = gameTime / 60;
    const baseHp = 50 * Math.pow(1.15, Math.floor(minutes));
    const hp = (isBoss ? baseHp * 15 : baseHp) * hpMult;

    const newEnemy: Enemy = {
        id: Math.random(),
        type: (isBoss ? 'boss' : shapeDef.type) as 'boss' | ShapeType,
        x, y,
        size,
        hp,
        maxHp: hp,
        spd: 2.4 * shapeDef.speedMult,
        boss: isBoss,
        bossType: isBoss ? Math.floor(Math.random() * 2) : 0,
        bossAttackPattern: 0,
        dead: false,
        shape: shapeDef.type as ShapeType,
        shellStage: 2,
        palette: activeColors,
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
        spawnedAt: state.gameTime
    };

    state.enemies.push(newEnemy);
}

export function spawnRareEnemy(state: GameState) {
    const { player } = state;
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
        type: 'square', x, y,
        hp: 1, maxHp: 3, spd: player.speed * 0.8, // 0.8x player speed
        boss: false, bossType: 0, bossAttackPattern: 0, lastAttack: 0, dead: false,
        shape: 'snitch', shellStage: 2, palette: ['#FACC15', '#EAB308', '#CA8A04'],
        pulsePhase: 0, rotationPhase: 0, timer: Date.now(),
        isRare: true, size: 25, rarePhase: 0, rareTimer: state.gameTime, rareIntent: 0, rareReal: true, canBlock: false,
        trails: [], longTrail: [{ x, y }], wobblePhase: 0,
        knockback: { x: 0, y: 0 },
        glitchPhase: 0, crackPhase: 0, particleOrbit: 0,
        spawnedAt: state.gameTime
    };
    state.enemies.push(rareEnemy);
    playSfx('rare-spawn');
    state.rareSpawnActive = true;
}

function manageRareSpawnCycles(state: GameState) {
    const { gameTime, rareSpawnCycle, rareSpawnActive } = state;
    if (rareSpawnActive) return;

    const nextSpawnTime = 60 + (rareSpawnCycle * 120);

    if (gameTime >= nextSpawnTime) {
        spawnRareEnemy(state);
        state.rareSpawnCycle++;
    }
}

function spawnMinion(state: GameState, parent: Enemy) {
    const minionHp = parent.maxHp * 0.15;
    const newMinion: Enemy = {
        id: Math.random(),
        type: 'minion',
        x: parent.x, y: parent.y,
        size: 12,
        hp: minionHp,
        maxHp: minionHp,
        spd: 6, // Fast
        boss: false, bossType: 0, bossAttackPattern: 0, lastAttack: 0, dead: false,
        shape: 'minion',
        shellStage: 0,
        palette: parent.palette,
        pulsePhase: 0,
        rotationPhase: Math.random() * 6.28,
        spawnedAt: state.gameTime,
        knockback: { x: 0, y: 0 },
        isRare: false
    };
    state.enemies.push(newMinion);
}

function spawnShield(state: GameState, x: number, y: number) {
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
        pulsePhase: 0,
        rotationPhase: Math.random() * 6.28,
        spawnedAt: state.gameTime,
        knockback: { x: 0, y: 0 },
        isRare: false
    };
    state.enemies.push(shield);
}
