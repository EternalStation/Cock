import { useRef, useEffect, useState, useCallback } from 'react';
import gameWorkerUrl from '../logic/gameWorker?worker&url';
import type { GameState, UpgradeChoice, LegendaryHex } from '../logic/types';
import { createInitialGameState } from '../logic/GameState';
import { updatePlayer } from '../logic/PlayerLogic';
import { updateEnemies } from '../logic/EnemyLogic';
import { updateProjectiles, spawnBullet } from '../logic/ProjectileLogic';

import { spawnUpgrades, applyUpgrade } from '../logic/UpgradeLogic';
import { calcStat } from '../logic/MathUtils';
import { updateLoot } from '../logic/LootLogic';
import { updateParticles, spawnParticles, spawnFloatingNumber } from '../logic/ParticleLogic'; // Added spawnParticles import
import { ARENA_CENTERS, ARENA_RADIUS, PORTALS, getHexWallLine } from '../logic/MapLogic';
import { playSfx, updateBGMPhase, duckMusic, restoreMusic, pauseMusic, resumeMusic, startBossAmbience, stopBossAmbience, startPortalAmbience, stopPortalAmbience } from '../logic/AudioLogic';
import { syncLegendaryHex, applyLegendarySelection } from '../logic/LegendaryLogic';


// Refactored Modules
import { renderGame } from '../logic/GameRenderer';
import { useGameInput } from './useGameInput';

export function useGameLoop(gameStarted: boolean) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameState = useRef<GameState>(createInitialGameState());
    const requestRef = useRef<number>(0);

    // Fixed Time Step Logic
    const lastTimeRef = useRef<number>(0);
    const accRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);
    const workerRef = useRef<Worker | null>(null);
    const isTabHidden = useRef<boolean>(false);

    // Pause state refs (so loop can check current state without closure issues)
    const showStatsRef = useRef(false);
    const showSettingsRef = useRef(false);
    const showModuleMenuRef = useRef(false);
    const upgradeChoicesRef = useRef<UpgradeChoice[] | null>(null);

    // Image Preloading
    const meteoriteImagesRef = useRef<Record<string, HTMLImageElement>>({});


    useEffect(() => {
        const qualities = ['Broken', 'Damaged', 'New'];
        for (let i = 1; i <= 9; i++) {
            qualities.forEach(q => {
                const key = `M${i}${q}`;
                const img = new Image();
                img.src = `/assets/meteorites/${key}.png`;
                meteoriteImagesRef.current[key] = img;
            });
        }



        const zombieImg = new Image();
        zombieImg.src = '/assets/Enemies/Zombie.png';
        (meteoriteImagesRef.current as any).zombie = zombieImg;

        const fearImg = new Image();
        fearImg.src = '/assets/Icons/FearSkill.png';
        (meteoriteImagesRef.current as any).fear = fearImg;

        const dmImg = new Image();
        dmImg.src = '/assets/Icons/DeathMark.png';
        (meteoriteImagesRef.current as any).deathMark = dmImg;

        // Preload Hex Icons for UI stability
        ['ComCrit', 'ComWave', 'DefPuddle', 'DefEpi', 'DefShield'].forEach(hex => {
            const img = new Image();
            img.src = `/assets/hexes/${hex}.png`;
            (meteoriteImagesRef.current as any)[hex] = img; // Store in ref to keep alive/cached
        });

        // Initialize Background Worker
        workerRef.current = new Worker(gameWorkerUrl, { type: 'module' });
        workerRef.current.postMessage({ type: 'start', interval: 1000 / 60 });

        const handleVisibility = () => {
            isTabHidden.current = document.visibilityState === 'hidden';
            console.log('Visibility Changed:', document.visibilityState);
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            workerRef.current?.terminate();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    // React state for UI overlays
    const [uiState, setUiState] = useState<number>(0);
    const [upgradeChoices, setUpgradeChoices] = useState<UpgradeChoice[] | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [bossWarning, setBossWarning] = useState<number | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showModuleMenu, setShowModuleMenu] = useState(false);
    const [showLegendarySelection, setShowLegendarySelection] = useState(false);

    // Sync refs with state
    showStatsRef.current = showStats;
    showSettingsRef.current = showSettings;
    showModuleMenuRef.current = showModuleMenu;
    upgradeChoicesRef.current = upgradeChoices;

    // Extracted Input Logic
    const { keys, inputVector, handleJoystickInput } = useGameInput({
        gameState,
        setShowSettings,
        setShowStats,
        setShowModuleMenu,
        setGameOver
    });

    const restartGame = () => {
        gameState.current = createInitialGameState();
        setGameOver(false);
        setUpgradeChoices(null);
        setBossWarning(null);
        setShowSettings(false);
        setShowModuleMenu(false);
    };

    const handleUpgradeSelect = (choice: UpgradeChoice) => {
        applyUpgrade(gameState.current, choice);
        setUpgradeChoices(null);
    };

    const handleLegendarySelect = (selection: LegendaryHex) => {
        const state = gameState.current;
        const existingIdx = state.moduleSockets.hexagons.findIndex(h => h && h.type === selection.type);

        if (existingIdx !== -1) {
            // AUTO-UPGRADE Logic - Sync with state and record level start kills
            const existing = state.moduleSockets.hexagons[existingIdx]!;
            existing.level = Math.min(5, existing.level + 1);

            if (!existing.killsAtLevel) existing.killsAtLevel = {};
            existing.killsAtLevel[existing.level] = state.killCount;

            syncLegendaryHex(existing);
            state.upgradingHexIndex = existingIdx;
            state.upgradingHexTimer = 3.0;

            // Sync both React State AND Game State
            state.showModuleMenu = true;
            state.isPaused = true;
            state.showLegendarySelection = false;

            setShowLegendarySelection(false);
            setShowModuleMenu(true);
            playSfx('merge-complete');
        } else {
            // NEW PLACEMENT - Use the shared logic to setup soul tracking
            applyLegendarySelection(state, selection);
            setShowLegendarySelection(false);
            // The shared logic handles pending placement and menu toggles in the state,
            // we just need to sync the React UI state.
            if (state.showModuleMenu) setShowModuleMenu(true);
        }
    };

    // Extracted Logic Update to be reusable for both rAF and Worker
    const updateLogic = useCallback((state: GameState, step: number) => {
        const eventHandler = (event: string, _data?: any) => {
            if (event === 'level_up') {
                const choices = spawnUpgrades(state, false);
                setUpgradeChoices(choices);
                playSfx('level');
            }
            if (event === 'boss_kill') {
                state.bossKills = (state.bossKills || 0) + 1;
                // Legendary selection is handled in logic files (PlayerLogic/ProjectileLogic),
                // but we trigger the React UI here.
                setShowLegendarySelection(true);
            }
            if (event === 'game_over') {
                setGameOver(true);

            }
        };

        updatePlayer(state, keys.current, eventHandler, inputVector.current);

        if (state.spawnTimer > 0.95 && !state.hasPlayedSpawnSound) {
            playSfx('spawn');
            state.hasPlayedSpawnSound = true;
        }

        state.camera.x = state.player.x;
        state.camera.y = state.player.y;

        updateEnemies(state, eventHandler, step);

        // --- ACTIVE SKILL & AREA EFFECT LOGIC (Processed BEFORE Projectiles to apply Debuffs) ---

        // Cooldowns
        state.player.activeSkills.forEach(s => {
            if (s.cooldown > 0) s.cooldown -= step;
        });

        // Reset frame-based buffs
        if (state.player.buffs) {
            state.player.buffs.puddleRegen = false;
            if (state.player.buffs.epicenterShield && state.player.buffs.epicenterShield > 0) {
                state.player.buffs.epicenterShield -= step;
                if (state.player.buffs.epicenterShield < 0) state.player.buffs.epicenterShield = 0;
            }
        }

        // Area Effects
        for (let i = state.areaEffects.length - 1; i >= 0; i--) {
            const effect = state.areaEffects[i];
            effect.duration -= step;

            if (effect.type === 'puddle') {
                if (Math.random() < 0.3) {
                    spawnParticles(state, effect.x + (Math.random() - 0.5) * effect.radius * 1.5, effect.y + (Math.random() - 0.5) * effect.radius * 1.5, '#4ade80', 1, 2, 60, 'bubble');
                }
                if (Math.random() < 0.1) {
                    spawnParticles(state, effect.x + (Math.random() - 0.5) * effect.radius, effect.y + (Math.random() - 0.5) * effect.radius, '#10b981', 1, 4, 100, 'vapor');
                }
            } else if (effect.type === 'epicenter') {
                if (Math.random() < 0.4) {
                    // Ice Shards
                    spawnParticles(state, effect.x + (Math.random() - 0.5) * effect.radius * 1.2, effect.y + (Math.random() - 0.5) * effect.radius * 1.2, ['#ffffff', '#22d3ee', '#0ea5e9'], 1, 3, 30, 'spark');
                }
                if (Math.random() < 0.2) {
                    // Cold Mist
                    spawnParticles(state, effect.x + (Math.random() - 0.5) * effect.radius * 1.3, effect.y + (Math.random() - 0.5) * effect.radius * 1.3, ['#e0f2fe', '#ffffff'], 1, 5, 120, 'vapor');
                }
                if (Math.random() < 0.05) {
                    // Frost Flares (Little stars/glows)
                    spawnParticles(state, effect.x + (Math.random() - 0.5) * effect.radius, effect.y + (Math.random() - 0.5) * effect.radius, '#bae6fd', 1, 2, 40, 'spark');
                }
            }

            if (effect.type === 'puddle') {
                // Puddle Logic
                const range = effect.radius;
                // Check Player Buff
                const dToPlayer = Math.hypot(effect.x - state.player.x, effect.y - state.player.y);
                if (dToPlayer < range && effect.level >= 3) {
                    state.player.buffs = state.player.buffs || {};
                    state.player.buffs.puddleRegen = true;
                }

                // Enemies
                state.enemies.forEach(e => {
                    if (e.dead) return;
                    const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                    if (dist < range + e.size) {
                        // Apply Slow (Lvl 1: 20%, Lvl 4: 30%)
                        const slowAmt = effect.level >= 4 ? 0.30 : 0.20;
                        e.slowFactor = Math.max(e.slowFactor || 0, slowAmt);

                        // Apply Damage Taken Amp (Lvl 1: +20%, Lvl 4: +30%)
                        const dmgAmp = effect.level >= 4 ? 1.3 : 1.2;
                        e.takenDamageMultiplier = Math.max(e.takenDamageMultiplier || 1.0, dmgAmp);

                        // Lvl 2: DoT 5% Max HP / sec
                        if (effect.level >= 2) {
                            const dotDmg = (e.maxHp * 0.05) * step;
                            e.hp -= dotDmg;
                            if (e.hp <= 0) e.hp = 0; // Death handled in updateEnemies

                            // OPTIMIZATION: Only show DoT numbers approx every 0.5s to avoid clutter
                            // Use e.id + gameTime to stagger numbers
                            if (Math.floor(state.gameTime * 2) > Math.floor((state.gameTime - step) * 2)) {
                                const tickVal = Math.ceil(e.maxHp * 0.05 * 0.5); // Damage over 0.5s
                                spawnFloatingNumber(state, e.x, e.y, tickVal.toString(), '#4ade80', false);
                            }
                        }
                    }
                });

                // Visuals handled by renderer reading areaEffects
            } else if (effect.type === 'epicenter') {
                const range = 500;
                const pulseInterval = 0.5; // 0.5 sec
                effect.pulseTimer = (effect.pulseTimer || 0) + step;

                // Slow Aura (Constant)
                const slowAmt = effect.level >= 4 ? 0.80 : 0.70;
                state.enemies.forEach(e => {
                    if (e.dead) return;
                    const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                    if (dist < range) {
                        e.slowFactor = Math.max(e.slowFactor || 0, slowAmt);
                    }
                });

                if (effect.pulseTimer >= pulseInterval) {
                    effect.pulseTimer = 0;
                    // Deal Damage
                    const dmgPct = effect.level >= 4 ? 0.35 : 0.25;
                    const pDmg = calcStat(state.player.dmg);
                    const dmg = pDmg * dmgPct; // "25% of player dmg"

                    state.enemies.forEach(e => {
                        if (e.dead) return;
                        const dist = Math.hypot(e.x - effect.x, e.y - effect.y);
                        if (dist < range) {
                            e.hp -= dmg;
                            // OPTIMIZATION: Reduce visual clutter slightly to prevent lag with many enemies
                            if (Math.random() < 0.25) {
                                spawnFloatingNumber(state, e.x, e.y, Math.round(dmg).toString(), '#0ea5e9', false);
                            }

                            // Tiny red/orange particle bursts on spike hits
                            if (Math.random() < 0.1) {
                                const particleColor = Math.random() > 0.5 ? '#ef4444' : '#f97316';
                                spawnParticles(state, e.x, e.y, particleColor, 2, 2, 20, 'spark');
                            }
                        }
                    });
                    playSfx('ice-loop');
                }
            }

            if (effect.duration <= 0) {
                if (effect.type === 'epicenter') state.player.immobilized = false;
                state.areaEffects.splice(i, 1);
            }
        }

        updateProjectiles(state, eventHandler);
        updateLoot(state);

        // --- PORTAL LOGIC ---
        if (state.portalState !== 'transferring') {
            state.portalTimer -= step;
            if (state.portalState === 'closed' && state.portalTimer <= 10) {
                state.portalState = 'warn';
                playSfx('warning');
            } else if (state.portalState === 'warn' && state.portalTimer <= 0) {
                state.portalState = 'open';
                state.portalTimer = state.portalOpenDuration;
                startPortalAmbience();
                playSfx('spawn');
            } else if (state.portalState === 'open') {
                if (state.portalTimer <= 0) {
                    state.portalState = 'closed';
                    state.portalTimer = 240;
                    stopPortalAmbience();
                } else {
                    const activePortals = PORTALS.filter(p => p.from === state.currentArena);
                    const currentArenaCenter = ARENA_CENTERS.find(c => c.id === state.currentArena) || ARENA_CENTERS[0];
                    for (const p of activePortals) {
                        const wall = getHexWallLine(currentArenaCenter.x, currentArenaCenter.y, ARENA_RADIUS, p.wall);
                        const num = Math.abs((wall.y2 - wall.y1) * state.player.x - (wall.x2 - wall.x1) * state.player.y + wall.x2 * wall.y1 - wall.y2 * wall.x1);
                        const den = Math.hypot(wall.y2 - wall.y1, wall.x2 - wall.x1);
                        const dist = num / den;
                        const wcx = (wall.x1 + wall.x2) / 2;
                        const wcy = (wall.y1 + wall.y2) / 2;
                        const distToCenter = Math.hypot(state.player.x - wcx, state.player.y - wcy);
                        const wallLen = den;
                        if (dist < 100 && distToCenter < wallLen / 2 + 50) {
                            state.portalState = 'transferring';
                            state.transferTimer = 3.0;
                            state.nextArenaId = p.to;

                            // Immediate Despawn to prevent interaction during animation
                            state.enemies = [];
                            state.bullets = [];
                            state.enemyBullets = [];
                            state.spatialGrid.clear();

                            playSfx('rare-despawn');
                            stopPortalAmbience();
                            break;
                        }
                    }
                }
            }
        } else {
            state.transferTimer -= step;
            if (state.transferTimer <= 0 && state.nextArenaId !== null) {
                const oldArena = state.currentArena;
                const newArena = state.nextArenaId;
                const destCenter = ARENA_CENTERS.find(c => c.id === newArena) || ARENA_CENTERS[0];
                const reversePortal = PORTALS.find(p => p.from === newArena && p.to === oldArena);
                if (reversePortal) {
                    const wall = getHexWallLine(destCenter.x, destCenter.y, ARENA_RADIUS, reversePortal.wall);
                    const wcx = (wall.x1 + wall.x2) / 2;
                    const wcy = (wall.y1 + wall.y2) / 2;
                    state.player.x = wcx - wall.nx * 300;
                    state.player.y = wcy - wall.ny * 300;
                    state.player.knockback = { x: -wall.nx * 80, y: -wall.ny * 80 };
                } else {
                    state.player.x = destCenter.x;
                    state.player.y = destCenter.y;
                }
                state.currentArena = newArena;
                state.nextArenaId = null;
                state.enemies = [];
                state.bullets = [];
                state.drones.forEach(d => { d.x = state.player.x; d.y = state.player.y; });
                state.portalState = 'closed';
                state.portalTimer = 240;

                // Switch BGM for the new arena
                const switchArenaMusic = async (id: number) => {
                    const { switchBGM } = await import('../logic/AudioLogic');
                    switchBGM(id);
                };
                switchArenaMusic(newArena);

                playSfx('spawn');
            }
        }

        state.enemies = state.enemies.filter(e => !e.dead);


        const { player } = state;
        const atkScore = Math.min(9999, calcStat(player.atk));
        const fireDelay = 200000 / atkScore;

        if (Date.now() - player.lastShot > fireDelay && state.spawnTimer <= 0 && state.portalState !== 'transferring') {
            const d = calcStat(player.dmg);
            for (let i = 0; i < player.multi; i++) {
                const offset = (i - (player.multi - 1) / 2) * 0.15;
                spawnBullet(state, player.x, player.y, player.targetAngle, d, player.pierce, offset);
            }
            player.lastShot = Date.now();
            playSfx('shoot');
        }

        state.drones.forEach((d, i) => {
            d.a += 0.05;
            d.x = player.x + Math.cos(d.a + (i * 2)) * 60;
            d.y = player.y + Math.sin(d.a + (i * 2)) * 60;
            if (Date.now() - d.last > 800) {
                const droneDmgMult = player.droneCount > 3 ? Math.pow(2, player.droneCount - 3) : 1;
                spawnBullet(state, d.x, d.y, player.targetAngle, calcStat(player.dmg) * droneDmgMult, player.pierce);
                d.last = Date.now();
            }
        });

        updateParticles(state);
        if (state.critShake > 0) state.critShake *= 0.85;
        state.gameTime += step;
        state.frameCount++;

        const timeLeft = state.nextBossSpawnTime - state.gameTime;
        if (timeLeft <= 10 && timeLeft > 0) {
            const displayTime = Math.ceil(timeLeft);
            if (bossWarning !== displayTime) setBossWarning(displayTime);
        } else {
            if (bossWarning !== null) setBossWarning(null);
        }

        const activeBoss = state.enemies.some(e => e.boss);
        const targetPresence = activeBoss ? 1.0 : 0.0;
        state.bossPresence = state.bossPresence + (targetPresence - state.bossPresence) * 0.02;

        if (activeBoss) startBossAmbience();
        else stopBossAmbience();
    }, [bossWarning, keys, inputVector, setUpgradeChoices, setShowLegendarySelection, setGameOver, setBossWarning]);

    // Game Loop
    useEffect(() => {
        let cancelled = false;
        lastTimeRef.current = performance.now();
        const loop = () => {
            if (cancelled) return;
            const now = performance.now();
            const dt = (now - lastTimeRef.current) / 1000;
            lastTimeRef.current = now;

            // Cap dt to prevent spiral of death if tab inactive
            const safeDt = Math.min(dt, 0.25); // Increased cap to support catching up from lower FPS

            // If tab is hidden, we skip the main loop logic here and let the worker message handle it
            // This prevents duplicate updates if both rAF and Worker are firing
            if (isTabHidden.current) {
                requestRef.current = requestAnimationFrame(loop);
                return;
            }

            const state = gameState.current;

            // If game hasn't started, just render one frame and pause logic
            if (!gameStarted) {
                // Drawing (Always draw to ensure canvas isn't blank if needed, though MainMenu covers it)
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx) {
                    // renderGame(ctx, state); // Optional: render static frame or nothing
                }
                requestRef.current = requestAnimationFrame(loop);
                return;
            }

            // Pausing Logic (check refs for current values)
            const isMenuOpen = showStatsRef.current || showSettingsRef.current || showModuleMenuRef.current || upgradeChoicesRef.current !== null || state.showLegendarySelection;
            state.isPaused = isMenuOpen;
            if (state.isPaused) {
                // Ensure keys are cleared when pausing to prevent stuck movement
                Object.keys(keys.current).forEach(k => keys.current[k] = false);
            }

            // Music volume control based on menu state
            const inStats = showStatsRef.current;
            const inSettings = showSettingsRef.current;
            const inModuleMenu = showModuleMenuRef.current;

            if (inSettings) {
                pauseMusic(); // ESC menu stops music
            } else if (inStats || inModuleMenu) {
                resumeMusic(); // Ensure music is playing
                duckMusic(); // Duck by 15% for stats AND matrix
            } else {
                resumeMusic(); // Ensure music is playing
                restoreMusic(); // Restore full volume (including when in upgrade menu)
            }

            // Only accumulate time if not paused
            if (state.isPaused || state.gameOver) {
                accRef.current = 0; // Prevent "fast-forward" catch-up when unpausing
            } else {
                accRef.current += safeDt;
            }

            const FIXED_STEP = 1 / 60;

            if (!state.isPaused && !state.gameOver) {
                // Fixed Update Step
                let steps = 0;
                // Increased max steps to 20 to prioritize simulation speed over frame consistency during lag spikes
                while (accRef.current >= FIXED_STEP && steps < 20) {
                    accRef.current -= FIXED_STEP;
                    steps++;
                    // Update Logic
                    updateLogic(state, FIXED_STEP);


                }
            }

            // Panic Button: If we are still behind after 20 steps, drop the accumulator.
            if (accRef.current > FIXED_STEP * 20) {
                accRef.current = 0;
            }

            // Update BGM phase (runs even when paused)
            updateBGMPhase(state.gameTime);

            // Drawing
            // OPTIMIZATION: When paused (Menu Open), do NOT re-render the game canvas every frame.
            // This leaves the last frame visible (static background) and frees up Main Thread for React UI.
            if (!state.isPaused) {
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx) {
                    try {
                        renderGame(ctx, state, meteoriteImagesRef.current, windowScaleFactor.current);
                    } catch (e) {
                        console.error("Render Error:", e);
                    }
                    // Restore context if error happened mid-save
                    try { ctx.restore(); } catch (e) { }
                }
            }

            // Decrement auto-upgrade animation timer
            if (state.upgradingHexTimer > 0) {
                state.upgradingHexTimer -= safeDt;
                if (state.upgradingHexTimer <= 0) {
                    state.upgradingHexTimer = 0;
                    state.upgradingHexIndex = null;
                }
            }

            // Sync Legendary Selection state
            if (state.showLegendarySelection && !showLegendarySelection) {
                setShowLegendarySelection(true);
            }

            // Force Re-render for UI updates (Throttled to ~15 FPS)
            frameCountRef.current++;
            if (frameCountRef.current % 4 === 0) {
                setUiState(prev => prev + 1);
            }

            // FPS Calculation
            framesRef.current++;
            if (now - lastFpsUpdateRef.current >= 1000) {
                setFps(Math.round(framesRef.current * 1000 / (now - lastFpsUpdateRef.current)));
                framesRef.current = 0;
                lastFpsUpdateRef.current = now;
            }

            requestRef.current = requestAnimationFrame(loop);
        };

        // Start Loop
        // Background Worker Message Handler
        if (workerRef.current) {
            workerRef.current.onmessage = (e) => {
                if (e.data.type === 'tick' && isTabHidden.current && gameStarted) {
                    // Drive logic when hidden
                    const state = gameState.current;
                    if (!state.isPaused && !state.gameOver) {
                        // Use a fixed step for background play
                        const FIXED_STEP = 1 / 60;
                        updateLogic(state, FIXED_STEP);
                    }
                }
            };
        }

        requestRef.current = requestAnimationFrame(loop);

        return () => {
            cancelled = true;
            cancelAnimationFrame(requestRef.current!);
        };
    }, [gameStarted, updateLogic, showLegendarySelection]); // Run when gameStarted changes, and updateLogic changes

    // FPS Calculation
    const [fps, setFps] = useState(60);
    const framesRef = useRef(0);
    const lastFpsUpdateRef = useRef(0);

    // Window Scale Factor Ref (Accessed by render logic)
    const windowScaleFactor = useRef(1);

    return {
        canvasRef,
        gameState: gameState.current,
        upgradeChoices,
        handleUpgradeSelect,
        gameOver,
        restartGame,
        bossWarning,
        showStats,
        setShowStats,
        showSettings,
        setShowSettings,
        showModuleMenu,
        setShowModuleMenu,
        showLegendarySelection,
        handleLegendarySelect,
        handleModuleSocketUpdate: (type: 'hex' | 'diamond', index: number, item: any) => {
            if (type === 'hex') {
                gameState.current.moduleSockets.hexagons[index] = item;
                gameState.current.pendingLegendaryHex = null; // Clear after placement
            }
            else gameState.current.moduleSockets.diamonds[index] = item;
            if (item) playSfx('socket-place');
            setUiState(prev => prev + 1); // Force re-render
        },
        updateInventorySlot: (index: number, item: any) => {
            gameState.current.inventory[index] = item;
            setUiState(prev => prev + 1);
        },
        toggleModuleMenu: () => {
            setShowModuleMenu(prev => {
                const next = !prev;
                if (next) {
                    setShowSettings(false);
                    setShowStats(false);
                    gameState.current.unseenMeteorites = 0;
                }
                return next;
            });
        },
        uiState,
        inputVector,
        handleJoystickInput,
        setWindowScaleFactor: (scale: number) => {
            windowScaleFactor.current = scale;
        },
        recycleMeteorite: (source: 'inventory' | 'diamond', index: number, amount: number) => {
            // Logic handled in component mostly, just state update here? 
            // Actually recycle logic is simple state mutation
            if (source === 'inventory') {
                gameState.current.inventory[index] = null;
            } else {
                gameState.current.moduleSockets.diamonds[index] = null;
            }
            gameState.current.player.dust += amount;
            playSfx('recycle');
            setUiState(p => p + 1);
        },
        spendDust: (amount: number) => {
            if (gameState.current.player.dust >= amount) {
                gameState.current.player.dust -= amount;
                setUiState(p => p + 1);
                return true;
            }
            return false;
        },
        fps
    };
}
