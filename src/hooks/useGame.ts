import { useRef, useEffect, useState } from 'react';
import gameWorkerUrl from '../logic/gameWorker?worker&url';
import type { GameState, UpgradeChoice, LegendaryHex, MeteoriteRarity } from '../logic/types';
import { createInitialGameState } from '../logic/GameState';
import { updatePlayer } from '../logic/PlayerLogic';
import { updateEnemies, spawnRareEnemy, spawnEnemy } from '../logic/EnemyLogic';
import { updateProjectiles, spawnBullet } from '../logic/ProjectileLogic';
import { updateBossBehavior } from '../logic/BossLogic';
import { spawnUpgrades, applyUpgrade } from '../logic/UpgradeLogic';
import { calcStat } from '../logic/MathUtils';
import { updateLoot, createMeteorite } from '../logic/LootLogic';
import { updateParticles } from '../logic/ParticleLogic';
import { ARENA_CENTERS, ARENA_RADIUS, PORTALS, getHexWallLine } from '../logic/MapLogic';
import { playSfx, startBGM, updateBGMPhase, duckMusic, restoreMusic, pauseMusic, resumeMusic, startBossAmbience, stopBossAmbience, startPortalAmbience, stopPortalAmbience } from '../logic/AudioLogic';
import { calculateLegendaryBonus } from '../logic/LegendaryLogic';

export function useGameLoop(gameStarted: boolean) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameState = useRef<GameState>(createInitialGameState());
    const requestRef = useRef<number>(0);
    const keys = useRef<Record<string, boolean>>({});
    // Fixed Time Step Logic
    const lastTimeRef = useRef<number>(0);
    const accRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);
    const workerRef = useRef<Worker | null>(null);
    const isTabHidden = useRef<boolean>(false);

    // Pause state refs (so loop can check current state without closure issues)
    const showStatsRef = useRef(false);
    const showSettingsRef = useRef(false);
    const showInventoryRef = useRef(false); // New Ref
    const showModuleMenuRef = useRef(false);
    const upgradeChoicesRef = useRef<UpgradeChoice[] | null>(null);

    // Image Preloading
    const meteoriteImagesRef = useRef<Record<string, HTMLImageElement>>({});

    useEffect(() => {
        const rarities = ['scrap', 'anomalous', 'quantum', 'astral', 'radiant'];
        rarities.forEach(r => {
            const img = new Image();
            img.src = `/assets/meteorites/${r}NoBackgound.png`;
            meteoriteImagesRef.current[r] = img;
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
    const [showInventory, setShowInventory] = useState(false); // New State
    const [showModuleMenu, setShowModuleMenu] = useState(false);
    const [showLegendarySelection, setShowLegendarySelection] = useState(false);

    // Sync refs with state
    showStatsRef.current = showStats;
    showSettingsRef.current = showSettings;
    showInventoryRef.current = showInventory; // Sync
    showModuleMenuRef.current = showModuleMenu;
    upgradeChoicesRef.current = upgradeChoices;

    // Input Handling
    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const key = e.key.toLowerCase();
            const code = e.code.toLowerCase();

            // Start music on first interaction
            startBGM();

            if (key === 'escape') {
                setShowSettings(p => !p);
            }

            // Handle C key for stats toggle (Always allow if gameStarted or in Main Menu)
            if (key === 'c') {
                setShowStats(prev => {
                    const next = !prev;
                    if (next) {
                        setShowSettings(false);
                        setShowInventory(false);
                        setShowModuleMenu(false);
                    }
                    return next;
                });
            }

            // Handle I key for inventory toggle
            if (key === 'i') {
                setShowInventory(prev => {
                    const next = !prev;
                    if (next) {
                        setShowSettings(false);
                        setShowStats(false);
                        setShowModuleMenu(false);
                    }
                    return next;
                });
                gameState.current.isInventoryOpen = !gameState.current.isInventoryOpen;
            }

            // Handle M key for module matrix toggle
            if (key === 'm') {
                setShowModuleMenu(prev => {
                    const next = !prev;
                    if (next) {
                        setShowSettings(false);
                        setShowStats(false);
                        setShowInventory(false);
                    }
                    return next;
                });
                gameState.current.showModuleMenu = !gameState.current.showModuleMenu;
            }

            // Track movement keys - use e.code for WASD and Arrow keys for better reliability
            if (['keyw', 'keys', 'keya', 'keyd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(code)) {
                keys.current[code] = true;
            } else {
                // Also fallback to key for other keys
                keys.current[key] = true;
            }
        };

        const handleUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const code = e.code.toLowerCase();
            keys.current[key] = false;
            keys.current[code] = false;
        };

        // Cheat Code Buffer
        let cheatBuffer = '';
        const handleCheat = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            cheatBuffer += key;
            if (cheatBuffer.length > 10) cheatBuffer = cheatBuffer.slice(-10);

            // K1 - Kill Player
            if (cheatBuffer.endsWith('k1')) {
                setGameOver(true);
                playSfx('hurt');
                cheatBuffer = '';
            }

            // L1 - Level Up
            if (cheatBuffer.endsWith('l1')) {
                gameState.current.player.xp.current = gameState.current.player.xp.needed;
                cheatBuffer = '';
            }

            // E1-E5 - Spawn 5 Enemies
            const shapes: Record<string, any> = { '1': 'circle', '2': 'triangle', '3': 'square', '4': 'diamond', '5': 'pentagon' };
            for (const [num, shape] of Object.entries(shapes)) {
                if (cheatBuffer.endsWith(`e${num}`)) {
                    const p = gameState.current.player;
                    for (let i = 0; i < 5; i++) {
                        const a = (i / 5) * Math.PI * 2;
                        spawnEnemy(gameState.current, p.x + Math.cos(a) * 400, p.y + Math.sin(a) * 400, shape);
                    }
                    cheatBuffer = '';
                }
            }

            // B1-B5 - Spawn 1 Boss
            for (const [num, shape] of Object.entries(shapes)) {
                if (cheatBuffer.endsWith(`b${num}`)) {
                    const p = gameState.current.player;
                    spawnEnemy(gameState.current, p.x + 500, p.y + 500, shape, true);
                    cheatBuffer = '';
                }
            }

            // E6 - Snitch
            if (cheatBuffer.endsWith('e6')) {
                spawnRareEnemy(gameState.current);
                cheatBuffer = '';
            }

            // M1-M5 - Spawn Meteorite
            const rarities: MeteoriteRarity[] = ['scrap', 'anomalous', 'quantum', 'astral', 'radiant'];
            for (let i = 1; i <= 5; i++) {
                if (cheatBuffer.endsWith(`m${i}`)) {
                    const met = createMeteorite(rarities[i - 1]);
                    const emptyIdx = gameState.current.inventory.findIndex(s => s === null);
                    if (emptyIdx !== -1) {
                        gameState.current.inventory[emptyIdx] = met;
                        setUiState(prev => prev + 1);
                    }
                    cheatBuffer = '';
                }
            }

            if (cheatBuffer.endsWith('por')) {
                // Trigger Portal Sequence (10s warning then open)
                gameState.current.portalState = 'closed';
                gameState.current.portalTimer = 10.1; // Slightly above 10 to ensure clean transition
                cheatBuffer = '';
            }
        };

        window.addEventListener('keydown', handleDown);
        window.addEventListener('keyup', handleUp);
        window.addEventListener('keydown', handleCheat);
        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('keyup', handleUp);
            window.removeEventListener('keydown', handleCheat);
        };
    }, [showSettings, showStats, showInventory, showModuleMenu]); // GameStarted removed from dependency to keep listeners active in Main Menu

    const restartGame = () => {
        gameState.current = createInitialGameState();
        setGameOver(false);
        setUpgradeChoices(null);
        setBossWarning(null);
        setShowSettings(false);
        setShowInventory(false);
        setShowModuleMenu(false);
    };

    const handleUpgradeSelect = (choice: UpgradeChoice) => {
        applyUpgrade(gameState.current, choice);
        setUpgradeChoices(null);
    };

    const handleLegendarySelect = (selection: LegendaryHex) => {
        gameState.current.pendingLegendaryHex = selection;
        gameState.current.showLegendarySelection = false;
        setShowLegendarySelection(false);
        setShowModuleMenu(true);
        gameState.current.showModuleMenu = true;
        gameState.current.isPaused = true;
        playSfx('merge-complete');
    };

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
            const safeDt = Math.min(dt, 0.1);

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
            const isMenuOpen = showStatsRef.current || showSettingsRef.current || showInventoryRef.current || showModuleMenuRef.current || upgradeChoicesRef.current !== null || state.showLegendarySelection;
            state.isPaused = isMenuOpen;
            if (state.isPaused) {
                // Ensure keys are cleared when pausing to prevent stuck movement
                Object.keys(keys.current).forEach(k => keys.current[k] = false);
            }

            // Music volume control based on menu state
            const inStats = showStatsRef.current;
            const inSettings = showSettingsRef.current;
            const inInventory = showInventoryRef.current; // Check inventory
            const inModuleMenu = showModuleMenuRef.current;

            if (inSettings) {
                pauseMusic(); // ESC menu stops music
            } else if (inStats || inInventory || inModuleMenu) {
                resumeMusic(); // Ensure music is playing
                duckMusic(); // Duck to 70% for stats AND inventory
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
                while (accRef.current >= FIXED_STEP) {
                    // Update Logic
                    updateLogic(state, FIXED_STEP);

                    accRef.current -= FIXED_STEP;
                }
            }

            // Update BGM phase (runs even when paused)
            updateBGMPhase(state.gameTime);

            // Drawing (Always draw)
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) {
                try {
                    renderGame(ctx, state, meteoriteImagesRef.current);
                } catch (e) {
                    console.error("Render Error:", e);
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
    }, [gameStarted]); // Run when gameStarted changes

    // Extracted Logic Update to be reusable for both rAF and Worker
    const updateLogic = (state: GameState, step: number) => {
        const eventHandler = (event: string, _data?: any) => {
            if (event === 'level_up') {
                const choices = spawnUpgrades(state, false);
                setUpgradeChoices(choices);
                playSfx('level');
            }
            if (event === 'boss_kill') {
                state.bossKills = (state.bossKills || 0) + 1;
                const choices = spawnUpgrades(state, true);
                setUpgradeChoices(choices);
                playSfx('level');
            }
            if (event === 'game_over') {
                setGameOver(true);
                playSfx('hurt');
            }
        };

        updatePlayer(state, keys.current, eventHandler);

        if (state.spawnTimer > 0.95 && !state.hasPlayedSpawnSound) {
            playSfx('spawn');
            state.hasPlayedSpawnSound = true;
        }

        state.camera.x = state.player.x;
        state.camera.y = state.player.y;

        updateEnemies(state, eventHandler);
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
                state.spawnTimer = 3.0;
                playSfx('spawn');
            }
        }

        state.enemies = state.enemies.filter(e => !e.dead);
        state.enemies.forEach(e => updateBossBehavior(e));

        const { player } = state;
        const atkScore = Math.min(9999, calcStat(player.atk) + calculateLegendaryBonus(state, 'ats_per_kill'));
        const fireDelay = 200000 / atkScore;

        if (Date.now() - player.lastShot > fireDelay && state.spawnTimer <= 0) {
            const d = calcStat(player.dmg) + calculateLegendaryBonus(state, 'dmg_per_kill');
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
        state.gameTime += step;
        state.frameCount++;

        const timeLeft = state.nextBossSpawnTime - state.gameTime;
        if (timeLeft <= 10 && timeLeft > 0) setBossWarning(timeLeft);
        else setBossWarning(null);

        const activeBoss = state.enemies.some(e => e.boss);
        const targetPresence = activeBoss ? 1.0 : 0.0;
        state.bossPresence = state.bossPresence + (targetPresence - state.bossPresence) * 0.02;

        if (activeBoss) startBossAmbience();
        else stopBossAmbience();
    };

    // FPS Calculation
    const [fps, setFps] = useState(60);
    const framesRef = useRef(0);
    const lastFpsUpdateRef = useRef(0);

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
        showInventory,
        setShowInventory,
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
            setUiState(prev => prev + 1); // Force re-render
        },
        updateInventorySlot: (index: number, item: any) => {
            gameState.current.inventory[index] = item;
            setUiState(prev => prev + 1);
        },
        uiState,
        fps // Expose FPS
    };
}

function renderGame(ctx: CanvasRenderingContext2D, state: GameState, meteoriteImages: Record<string, HTMLImageElement>) {
    const { width, height } = ctx.canvas;
    const { camera, player, enemies, bullets, enemyBullets, drones, particles } = state;

    // High-Quality Smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = width / dpr;
    const logicalHeight = height / dpr;

    // Clear
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    try {
        ctx.save();

        // Zoom / Camera Logic
        // 120% Vision = 0.8 scale roughly (1 / 1.25)
        // To keep player centered:
        // 1. Move origin to center of screen (logical)
        ctx.translate(logicalWidth / 2, logicalHeight / 2);
        // 2. Apply Scale - Zoom scale reduced by 15% (0.68 -> 0.58)
        ctx.scale(0.58, 0.58);
        // 3. Move origin to camera position (which follows player)
        ctx.translate(-camera.x, -camera.y);

        // Screen Shake Logic (Spawn OR Boss)
        // Use smoothed bossPresence for shake intensity
        if (state.spawnTimer > 0 || state.bossPresence > 0.01) {
            let intensity = 0;
            if (state.spawnTimer > 0) intensity += state.spawnTimer * 5;

            // Boss Shake: Scale with presence
            // "increased screen shake"
            if (state.bossPresence > 0) {
                intensity += 3 * state.bossPresence; // Constant rumble

                // Random intense shake
                if (Math.random() < 0.05 * state.bossPresence) {
                    intensity += 15 * state.bossPresence; // Harder hits
                }
            }

            const shakeX = (Math.random() - 0.5) * intensity;
            const shakeY = (Math.random() - 0.5) * intensity;
            ctx.translate(shakeX, shakeY);
        }

        // Global Darken for Boss (Background dim)
        if (state.bossPresence > 0.01) {
            // "slowly darken"
            ctx.fillStyle = `rgba(0, 0, 0, ${state.bossPresence * 0.7})`; // Max 0.7 opacity
            // Draw centered on camera to cover the viewport
            const vW = logicalWidth / 0.58;
            const vH = logicalHeight / 0.58;
            ctx.fillRect(camera.x - vW, camera.y - vH, vW * 2, vH * 2);
        }

        // --- VOID HEX VORTEX BACKGROUND ---

        // Helper: Draw Hex Grid
        // BACKGROUND GRID (Hexagons)
        const drawHexGrid = (r: number) => {
            const hDist = 1.5 * r;
            const vDist = Math.sqrt(3) * r;

            const scale = 0.58;
            const vW = logicalWidth / scale;
            const vH = logicalHeight / scale;
            const cX = camera.x;
            const cY = camera.y;

            const startX = Math.floor((cX - vW / 2) / hDist) - 1;
            const endX = Math.ceil((cX + vW / 2) / hDist) + 1;
            const startY = Math.floor((cY - vH / 2) / vDist) - 1;
            const endY = Math.ceil((cY + vH / 2) / vDist) + 2;

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.25; // Retain alpha from original stable layer

            for (let i = startX; i <= endX; i++) {
                for (let j = startY; j <= endY; j++) {
                    const x = i * hDist;
                    const y = j * vDist + (i % 2 === 0 ? 0 : vDist / 2);

                    // Simple hexagon draw
                    ctx.beginPath();
                    for (let k = 0; k < 6; k++) {
                        const ang = (Math.PI / 3) * k;
                        const px = x + r * Math.cos(ang);
                        const py = y + r * Math.sin(ang);
                        if (k === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1.0; // Reset alpha
        };

        // 1. STABLE LAYER (Background)
        drawHexGrid(120);

        // 2. Draw Arena Boarders (Thick Lines) - Drawn on top
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 30;
        ctx.globalAlpha = 0.3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ARENA_CENTERS.forEach(c => {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const ang = Math.PI / 3 * i;
                const hx = c.x + ARENA_RADIUS * Math.cos(ang);
                const hy = c.y + ARENA_RADIUS * Math.sin(ang);
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
        });
        ctx.restore();

        // --- PORTAL RENDERING ---
        if (state.portalState !== 'closed') {
            const activePortals = PORTALS.filter(p => p.from === state.currentArena);
            const center = ARENA_CENTERS.find(c => c.id === state.currentArena);

            if (center) {
                activePortals.forEach(p => {
                    const wall = getHexWallLine(center.x, center.y, ARENA_RADIUS, p.wall);

                    ctx.save();
                    // Glow
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = p.color;
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 10;
                    ctx.lineCap = 'round';

                    // Pulse opacity
                    if (state.portalState === 'warn') {
                        ctx.globalAlpha = 0.5 + Math.sin(state.gameTime * 10) * 0.5;
                        ctx.setLineDash([50, 50]); // Warning Dash
                    } else {
                        // OPEN
                        ctx.globalAlpha = 1.0;
                        ctx.lineWidth = 15 + Math.sin(state.gameTime * 20) * 5; // Energy pulse breadth
                    }

                    ctx.beginPath();
                    ctx.moveTo(wall.x1, wall.y1);
                    ctx.lineTo(wall.x2, wall.y2);
                    ctx.stroke();

                    ctx.restore();
                });
            }
        }

        // Void Rifts (Deep Layer) - REMOVED
        // "No remove those balck holes"

        // 2. MOVING MID LAYER (Parallax) - REMOVED
        // "remove that second hexogon grid"

        // 3. MID-GROUND FOG (Atmosphere)
        // Draw some "cloud" particles that swirl
        // 3. MID-GROUND FOG (Atmosphere) - REMOVED per user request ("remove 5 big circles")
        /*
        ctx.save();
        // ... fog code removed ...
        ctx.restore();
        */
        // (Keeping placeholder comment or just removing)


        // Particles moved to post-enemy render for smoke occlusion


        // Dropped Meteorites
        state.meteorites.forEach(m => {
            ctx.save();
            ctx.translate(m.x, m.y);

            // Bobbing animation
            const bob = Math.sin(state.gameTime * 3 + m.id) * 5;
            ctx.translate(0, bob);

            // Magnetized shake
            if (m.magnetized) {
                ctx.translate((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
            }

            const img = meteoriteImages[m.rarity];
            if (img && img.complete && img.naturalWidth !== 0) {
                // Draw high quality image
                const size = 32; // Standard icon size in world
                ctx.drawImage(img, -size / 2, -size / 2, size, size);

                // Add a additive glow only for rare ones
                if (m.rarity !== 'scrap') {
                    ctx.globalCompositeOperation = 'lighter';
                    // We avoid shadowBlur here too, just draw the image again semi-transparent
                    ctx.globalAlpha = 0.4;
                    ctx.drawImage(img, -size / 2 - 2, -size / 2 - 2, size + 4, size + 4);
                    ctx.globalAlpha = 1.0;
                    ctx.globalCompositeOperation = 'source-over';
                }
            } else {
                // Fallback to jagged rock shape if not loaded
                let color = '#9ca3af'; // Scrap
                if (m.rarity === 'anomalous') color = '#14b8a6';
                else if (m.rarity === 'quantum') color = '#06b6d4';
                else if (m.rarity === 'astral') color = '#a855f7';
                else if (m.rarity === 'radiant') color = '#eab308'; // Gold

                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.fillStyle = color;

                // Draw jagged rock shape (Scaled up 50%)
                ctx.beginPath();
                ctx.moveTo(0, -12);
                ctx.lineTo(9, -6);
                ctx.lineTo(12, 6);
                ctx.lineTo(0, 12);
                ctx.lineTo(-10.5, 7.5);
                ctx.lineTo(-9, -7.5);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            ctx.restore();
        });

        // Player Bullets (Drawn Under Player)
        bullets.forEach(b => {
            ctx.fillStyle = '#22d3ee'; // Cyan (Match Player)
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Player - Honeycomb Hexagon
        ctx.save();
        ctx.translate(player.x, player.y);

        const cellSize = 15.7; // Increased by 40% from 11.2

        // Helper function to draw a hexagon
        const drawHexagon = (x: number, y: number, r: number) => {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                // Flat-topped: Vertices at 0, 60, 120...
                const angle = (Math.PI / 3) * i;
                const px = x + r * Math.cos(angle);
                const py = y + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill(); // Opaque mask to hide projectiles underneath
            ctx.stroke();
        };

        // Setup style for honeycomb cells
        ctx.strokeStyle = '#22d3ee';
        ctx.fillStyle = '#020617'; // Match Background (Opaque)
        ctx.lineWidth = 2.5; // Slightly thicker for visibility
        ctx.setLineDash([]); // Ensure solid lines
        ctx.lineCap = 'round'; // Smooth corners
        ctx.lineJoin = 'round'; // Smooth joins to prevent "dots" at sharp corners

        // Persistent Cyan Glow (Model Light Emission)
        ctx.strokeStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';

        // Cyan Glow - Only during 3s spawn animation
        ctx.strokeStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';

        if (state.spawnTimer > 0) {
            // Intense energy materialization during spawn
            ctx.shadowBlur = 30 * (state.spawnTimer / 3.0);
        } else {
            // No bloom after animation ends
            ctx.shadowBlur = 0;
        }

        // Draw 7 connected honeycomb cells
        if (state.spawnTimer > 0) {
            // Animation Logic
            const progress = Math.max(0, 3.0 - state.spawnTimer) / 3.0; // 0 to 1 over 3s
            const ease = 1 - Math.pow(1 - progress, 3); // Cubic Out Easing
            const spin = (1.0 - ease) * Math.PI * 4; // Extra spins at start

            ctx.rotate(spin);

            // Center Cell - Scales up
            const scale = Math.min(1, ease * 1.5);
            if (scale > 0) {
                ctx.save();
                ctx.scale(scale, scale);
                drawHexagon(0, 0, cellSize);
                ctx.restore();
            }

            // Surrounding Cells - Fly in
            const finalDist = cellSize * Math.sqrt(3);
            const startDist = finalDist * 5; // Start further away
            const currentDist = startDist - (startDist - finalDist) * ease;

            ctx.globalAlpha = Math.min(1, ease * 2);
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i + Math.PI / 6;
                const cx = currentDist * Math.cos(angle);
                const cy = currentDist * Math.sin(angle);
                drawHexagon(cx, cy, cellSize);
            }
            ctx.globalAlpha = 1;
        } else {
            // Normal Static Draw
            // Center cell
            drawHexagon(0, 0, cellSize);

            // 6 surrounding cells
            const cellDistance = cellSize * Math.sqrt(3);
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i + Math.PI / 6;
                const cx = cellDistance * Math.cos(angle);
                const cy = cellDistance * Math.sin(angle);
                drawHexagon(cx, cy, cellSize);
            }
        }

        ctx.restore();

        // Stun VFX (Electricity)
        if (player.stunnedUntil && Date.now() < player.stunnedUntil) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.strokeStyle = '#00FFFF'; // Cyan Arcs
            ctx.lineWidth = 2;
            ctx.shadowColor = '#00FFFF';
            ctx.shadowBlur = 10;

            // Draw 3-5 random arcs
            const arcCount = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < arcCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 25 + Math.random() * 10;
                const startX = Math.cos(angle) * 15; // Inner
                const startY = Math.sin(angle) * 15;
                const endX = Math.cos(angle) * dist; // Outer
                const endY = Math.sin(angle) * dist;

                // Zigzag path
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 20;
                const midY = (startY + endY) / 2 + (Math.random() - 0.5) * 20;
                ctx.lineTo(midX, midY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Drones
        drones.forEach(d => {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });


        // --- PORTAL UI / OVERLAYS ---
        // 1. Transfer Darken
        if (state.portalState === 'transferring') {
            ctx.save();
            // Reset transforms to draw full screen overlay
            ctx.setTransform(1, 0, 0, 1, 0, 0);

            // Warp Tunnel Animation
            // "Creative and beautiful"
            // Center of screen
            const cx = width / 2;
            const cy = height / 2;

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            // Timer = 3.0 -> 0.0
            // Progress = 0 -> 1
            // const t = (3.0 - state.transferTimer) / 3.0; unused
            // const speed = t * t * 20; // Accelerating unused

            ctx.save();
            ctx.translate(cx, cy);

            // Rotating Hexagon Tunnel
            const color = '#22d3ee'; // Cyan portal color
            const baseSize = 50;

            for (let i = 0; i < 20; i++) {
                // Perspective depth
                const z = (state.gameTime * 2 + i * 0.5) % 10; // Moving forward
                const scale = Math.pow(1.5, z); // Exponential scale
                const alpha = Math.max(0, 1 - z / 10);

                ctx.strokeStyle = color;
                ctx.lineWidth = 2 + scale;
                ctx.globalAlpha = alpha;

                // Rotation based on depth
                ctx.rotate(state.gameTime + i * 0.1);

                ctx.beginPath();
                for (let j = 0; j < 6; j++) {
                    const ang = Math.PI / 3 * j;
                    const r = baseSize * scale;
                    if (j === 0) ctx.moveTo(r * Math.cos(ang), r * Math.sin(ang));
                    else ctx.lineTo(r * Math.cos(ang), r * Math.sin(ang));
                }
                ctx.closePath();
                ctx.stroke();

                // Reset rotation for next
                ctx.rotate(-(state.gameTime + i * 0.1));
            }

            // Flash at end
            if (state.transferTimer < 0.2) {
                ctx.fillStyle = '#FFFFFF';
                ctx.globalAlpha = (0.2 - state.transferTimer) / 0.2;
                ctx.fillRect(-cx, -cy, width, height);
            }

            ctx.restore();
        }

        // Snitch Trails (Breadcrumbs) - Draw BEHIND enemies
        enemies.forEach(e => {
            if (e.longTrail && e.longTrail.length > 1) {
                ctx.save();
                ctx.strokeStyle = '#FFD700'; // Gold
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 10;
                ctx.globalAlpha = 0.8;

                ctx.beginPath();
                e.longTrail.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
                ctx.restore();
            }
        });

        // Enemies
        // 1. Draw Merging Lines (Underneath)
        state.enemies.forEach(e => {
            if (e.mergeState === 'warming_up' && e.mergeTimer && !e.mergeHost) {
                // Find host
                const host = state.enemies.find(h => h.mergeId === e.mergeId && h.mergeHost);
                if (host) {
                    ctx.save();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.5 + Math.sin(state.gameTime * 20) * 0.5; // Fast pulse
                    ctx.setLineDash([10, 10]);
                    ctx.beginPath();
                    ctx.moveTo(e.x, e.y);
                    ctx.lineTo(host.x, host.y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        });

        enemies.forEach(e => {
            ctx.save();
            ctx.translate(e.x, e.y);

            // Apply Rotation
            if (e.rotationPhase) {
                ctx.rotate(e.rotationPhase);
            }

            // ELITE AURA
            if (e.isElite) {
                ctx.save();
                // Rotate aura opposite to enemy for stability or spin faster
                ctx.rotate(-(e.rotationPhase || 0) * 2);
                ctx.strokeStyle = e.palette[0];
                ctx.lineWidth = 4;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                // Spiked Halo
                const r = e.size * 1.5;
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    const ox = Math.cos(angle) * r;
                    const oy = Math.sin(angle) * r;
                    if (i === 0) ctx.moveTo(ox, oy);
                    else ctx.lineTo(ox, oy);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }

            // Pulse Animation (Breathing effect) - Scale 1.0 to 1.05
            const pulse = 1.0 + (Math.sin(e.pulsePhase || 0) * 0.05);
            ctx.scale(pulse, pulse);

            // Colors from Palette
            let coreColor = e.palette[0];
            let innerColor = e.palette[1];
            let outerColor = e.palette[2];

            // Pentagon Green/Red Pulse
            if (e.shape === 'pentagon') {
                const motherAge = state.gameTime - (e.spawnedAt || 0);
                const isAngry = (e.angryUntil && Date.now() < e.angryUntil);
                const isEnraged = motherAge >= 60;
                const isSuiciding = e.suicideTimer !== undefined;

                if (isSuiciding) {
                    const timeInSuicide = state.gameTime - e.suicideTimer!;
                    const suicideProgress = timeInSuicide / 5.0; // 0 to 1

                    // Increasingly intense red pulse
                    const pVal = (Math.sin(e.pulsePhase || 0) + 1) / 2;
                    outerColor = pVal > 0.3 ? '#FF0000' : '#880000';
                    innerColor = pVal > 0.5 ? '#FF5555' : '#440000';

                    // Violent shaking/scaling
                    const suicideScale = 1.0 + (pVal * 0.2 * suicideProgress);
                    ctx.scale(suicideScale, suicideScale);
                } else if (!isAngry && !isEnraged) {
                    const pVal = (Math.sin(e.pulsePhase || 0) + 1) / 2; // 0 to 1
                    if (pVal > 0.6) {
                        outerColor = '#4ade80'; // Bright Green
                        innerColor = '#22c55e'; // Medium Green
                    }
                }
            }

            // --- BOSS CHAOS CALCS ---
            let chaosLevel = 0;
            if (e.boss) {
                const minutes = state.gameTime / 60;
                chaosLevel = Math.min(1, Math.max(0, (minutes - 2) / 10)); // 0.0 - 1.0
            }

            // GLITCH EFFECT (Fake Snitch OR Boss)
            if ((e.glitchPhase && e.glitchPhase > 0) || e.boss) {
                const intensity = e.boss ? chaosLevel * 15 : 10;
                const flickerChance = e.boss ? 0.8 - (chaosLevel * 0.2) : 0.8; // Boss flickers more at high chaos

                // Random Jitter
                if (e.boss && Math.random() < chaosLevel * 0.3) {
                    const jitter = (Math.random() - 0.5) * intensity;
                    ctx.translate(jitter, -jitter);
                } else if (e.glitchPhase && !e.boss) {
                    // Snitch glitch
                    const jitter = (Math.random() - 0.5) * 10;
                    ctx.translate(jitter, -jitter);
                }

                if (Math.random() > flickerChance) {
                    ctx.globalAlpha = 0.6; // Flicker opacity
                }
            }

            // Shapes Helper
            const drawShape = (size: number, isWarpedLimit: boolean = false) => {
                ctx.beginPath();

                // BOSS WARP/WOBBLE (Hologram instability)
                // We'll use a custom vertex transformer if it's a boss
                const warpAmp = isWarpedLimit && e.boss ? (0.1 + chaosLevel * 0.2) * size : 0;
                // Helper to warp a point
                const wp = (px: number, py: number) => {
                    if (warpAmp === 0) return { x: px, y: py };
                    // Sin wave distort based on Y + Time
                    const offset = Math.sin((py / size) * 4 + (state.gameTime * 10)) * warpAmp;
                    return { x: px + offset, y: py };
                };

                if (e.shape === 'circle') {
                    if (warpAmp > 0) {
                        // Manual circle for warp
                        for (let i = 0; i <= 20; i++) {
                            const theta = (i / 20) * Math.PI * 2;
                            const px = Math.cos(theta) * size;
                            const py = Math.sin(theta) * size;
                            const p = wp(px, py);
                            if (i === 0) ctx.moveTo(p.x, p.y);
                            else ctx.lineTo(p.x, p.y);
                        }
                    } else {
                        ctx.arc(0, 0, size, 0, Math.PI * 2);
                    }
                } else if (e.shape === 'minion') {
                    // Minion Shape Logic
                    const isStrong = !!e.stunOnHit;

                    if (isStrong) {
                        // DOUBLE ARROW / LONG BODY (Strong Minion)
                        // Vertices relative to center (0,0)

                        // Extremely elongated for visibility
                        // 1. Front Tip (Longer)
                        const p1 = wp(size * 2.5, 0);
                        // 2. Wing Top
                        const p2 = wp(-size * 1.5, -size * 0.8);
                        // 3. Inner Notch Top
                        const p3 = wp(-size * 0.5, -size * 0.4);
                        // 4. Rear Wing Top
                        const p4 = wp(-size * 2.5, -size * 0.8);
                        // 5. Rear Notch (Center)
                        const p5 = wp(-size * 1.5, 0);
                        // 6. Rear Wing Bottom
                        const p6 = wp(-size * 2.5, size * 0.8);
                        // 7. Inner Notch Bottom
                        const p7 = wp(-size * 0.5, size * 0.4);
                        // 8. Wing Bottom
                        const p8 = wp(-size * 1.5, size * 0.8);

                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.lineTo(p3.x, p3.y);
                        ctx.lineTo(p4.x, p4.y);
                        ctx.lineTo(p5.x, p5.y);
                        ctx.lineTo(p6.x, p6.y);
                        ctx.lineTo(p7.x, p7.y);
                        ctx.lineTo(p8.x, p8.y);
                        ctx.closePath();
                    } else {
                        // STANDARD ARROW (Normal Minion)
                        // 1. Tip
                        const p1 = wp(size, 0);
                        // 2. Bottom Wing
                        const p2 = wp(-size, size * 0.7);
                        // 3. Rear Indent
                        const p3 = wp(-size * 0.3, 0);
                        // 4. Top Wing
                        const p4 = wp(-size, -size * 0.7);

                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.lineTo(p3.x, p3.y);
                        ctx.lineTo(p4.x, p4.y);
                        ctx.closePath();
                    }
                } else if (e.shape === 'triangle') {
                    const p1 = wp(0, -size);
                    const p2 = wp(size * 0.866, size * 0.5);
                    const p3 = wp(-size * 0.866, size * 0.5);
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.lineTo(p3.x, p3.y);
                    ctx.closePath();
                } else if (e.shape === 'square') {
                    const p1 = wp(-size, -size);
                    const p2 = wp(size, -size);
                    const p3 = wp(size, size);
                    const p4 = wp(-size, size);
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.lineTo(p3.x, p3.y);
                    ctx.lineTo(p4.x, p4.y);
                    ctx.closePath();
                } else if (e.shape === 'diamond') {
                    const p1 = wp(0, -size * 1.3);
                    const p2 = wp(size, 0);
                    const p3 = wp(0, size * 1.3);
                    const p4 = wp(-size, 0);
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.lineTo(p3.x, p3.y);
                    ctx.lineTo(p4.x, p4.y);
                    ctx.closePath();
                } else if (e.shape === 'pentagon') {
                    for (let i = 0; i < 5; i++) {
                        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                        const px = Math.cos(angle) * size;
                        const py = Math.sin(angle) * size;
                        const p = wp(px, py);
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    }
                    ctx.closePath();
                } else if (e.shape === 'snitch') {
                    // Triple-Blade Mechanical Wings
                    const bodyR = size * 0.7;

                    // Central Body Core
                    if (warpAmp > 0) {
                        for (let i = 0; i <= 20; i++) {
                            const theta = (i / 20) * Math.PI * 2;
                            const p = wp(Math.cos(theta) * bodyR, Math.sin(theta) * bodyR);
                            if (i === 0) ctx.moveTo(p.x, p.y);
                            else ctx.lineTo(p.x, p.y);
                        }
                    } else {
                        ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
                    }
                    ctx.closePath();

                    // Blade Segment Helper
                    const drawBlade = (side: number, angle: number, lengthMult: number, widthMult: number) => {
                        const start = wp(side * bodyR * 0.8, side * bodyR * angle);
                        const mid = wp(side * size * 2.2 * lengthMult, side * size * (angle + 0.4) * widthMult);
                        const end = wp(side * size * 2.0 * lengthMult, side * size * angle * widthMult);
                        const back = wp(side * bodyR * 0.8, side * bodyR * (angle - 0.2));

                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(mid.x, mid.y);
                        ctx.lineTo(end.x, end.y);
                        ctx.lineTo(back.x, back.y);
                        ctx.closePath();
                    };

                    // Render 3 blades per side
                    // Left 
                    drawBlade(-1, -0.6, 1.0, 1.0); // Top
                    drawBlade(-1, 0, 1.2, 0.5);   // Mid
                    drawBlade(-1, 0.6, 1.0, 1.0);  // Bottom

                    // Right
                    drawBlade(1, -0.6, 1.0, 1.0);  // Top
                    drawBlade(1, 0, 1.2, 0.5);    // Mid
                    drawBlade(1, 0.6, 1.0, 1.0);   // Bottom
                }
            };

            // --- VISUAL LAYER SYSTEM ---

            // BOSS: TRAOLS (Glitchy After-images) rendered BEFORE main body
            if (e.boss && e.trails) {
                e.trails.forEach(t => {
                    ctx.save();
                    // Trails are static in world space, but we are inside ctx.translate(e.x, e.y)
                    // So we need to undo that or just calculate relative
                    // Easier: Just draw them relative to current 0,0 if we stored relative? 
                    // Logic in EnemyLogic stored absolute X/Y. 
                    // So we need to undo the translate:
                    ctx.translate(-e.x, -e.y); // Back to world 0,0
                    ctx.translate(t.x, t.y); // To trail pos

                    ctx.scale(pulse, pulse); // Match scale
                    ctx.rotate(t.rotation); // Match rotation

                    ctx.strokeStyle = outerColor;
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = t.alpha * 0.5;
                    drawShape(e.size, false); // No warp on trails for perf/readability
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // 0. BOSS ONLY: PULSING RED SECONDARY OUTLINE (#FF0000)
            // "ALWAYS pulsing red secondary outline (#FF0000, thick, 1px flicker)"
            if (e.boss) {
                const flicker = Math.random() > 0.5 ? 1 : 0.8;
                const redAlpha = (0.6 + Math.sin(state.gameTime * 10) * 0.4) * flicker;
                ctx.strokeStyle = '#FF0000';
                ctx.lineWidth = 3; // Thick
                ctx.shadowColor = '#FF0000';
                ctx.shadowBlur = 20; // Big red glow
                ctx.globalAlpha = redAlpha;
                drawShape(e.size * 1.25, true); // Larger than outer (1.1)
                ctx.stroke();
                ctx.globalAlpha = 1.0; // Reset
            }

            // 1. OUTLINE (Thin glowing ring)
            // Offset 5-10% outward -> size * 1.1
            ctx.strokeStyle = outerColor;
            ctx.lineWidth = 1.5;

            // Only Bosses get shadowBlur for outline
            if (e.boss) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = outerColor;
            }

            drawShape(e.size * 1.1, true); // Warp active for boss
            ctx.stroke();

            // 2. INSIDE LAYER (Remaining 50%)
            // Semi-transparent glow overlay
            // We draw the full size shape, but the Core will cover the inner 50%
            ctx.fillStyle = innerColor;
            // Adjust alpha manually since we only have hex codes
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0; // No blur on fill to save perf/clean look
            drawShape(e.size, true);
            ctx.fill();

            // BOSS: BLACK VOIDS (Cracks in Inside Layer)
            if (e.boss) {
                ctx.save();
                ctx.clip(); // Clip to the shape just drawn

                ctx.fillStyle = '#000000';
                ctx.globalAlpha = 0.8;
                // Random cracks/voids
                // We use seeded random based on ID + crackPhase to make them "flicker"
                const seed = Math.floor(state.gameTime * 10); // 10Hz flicker
                // Draw 2-3 random polygons
                const crackCount = 2 + Math.floor(chaosLevel * 4);
                const r = (n: number) => {
                    const sin = Math.sin(n + e.id);
                    return sin - Math.floor(sin);
                };

                for (let k = 0; k < crackCount; k++) {
                    ctx.beginPath();
                    // Random center inside
                    const cx = (r(seed + k) - 0.5) * e.size * 1.2;
                    const cy = (r(seed + k + 100) - 0.5) * e.size * 1.2;
                    // Draw jagged shard
                    for (let v = 0; v < 4; v++) {
                        const ang = v * (Math.PI / 2) + r(k + v);
                        const dist = 5 + r(k * v) * 15;
                        const px = cx + Math.cos(ang) * dist;
                        const py = cy + Math.sin(ang) * dist;
                        if (v === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }

            // 3. CORE (Darker Center, 50% size)
            ctx.fillStyle = coreColor;
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
            drawShape(e.size * 0.5, true);
            ctx.fill();

            ctx.restore();
        });

        // Diamond Elite Laser Beams (Draw after enemies)
        enemies.forEach(e => {
            if (e.isElite && e.shape === 'diamond' && e.eliteState === 2 &&
                e.lockedTargetX !== undefined && e.lockedTargetY !== undefined) {
                ctx.save();

                // Pulsing laser effect
                const pulse = 0.8 + Math.sin(Date.now() / 50) * 0.2;

                // Draw outer glow
                ctx.strokeStyle = e.palette[1]; // Use era secondary color
                ctx.lineWidth = 8 * pulse;
                ctx.globalAlpha = 0.3;
                ctx.shadowBlur = 20;
                ctx.shadowColor = e.palette[1];
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.lockedTargetX, e.lockedTargetY);
                ctx.stroke();

                // Draw core beam
                ctx.strokeStyle = e.palette[0]; // Use era primary color
                ctx.lineWidth = 4 * pulse;
                ctx.globalAlpha = 0.9;
                ctx.shadowBlur = 10;
                ctx.shadowColor = e.palette[0];
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.lockedTargetX, e.lockedTargetY);
                ctx.stroke();

                // Draw bright center line
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#FFFFFF';
                ctx.beginPath();
                ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.lockedTargetX, e.lockedTargetY);
                ctx.stroke();

                ctx.restore();
            }
        });


        // Enemy Bullets
        enemyBullets.forEach(b => {
            ctx.fillStyle = b.color || '#ef4444'; // Use projectile color, default red if missing
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Particles
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life < 0.2 ? p.life * 5 : 1; // Fade out

            if (p.type === 'shard') {
                // Draw rotating triangle/shard
                ctx.save();
                ctx.translate(p.x, p.y);
                const rot = state.gameTime * 5 + (p.x * 0.1); // Add some chaos
                ctx.rotate(rot);
                ctx.beginPath();
                ctx.moveTo(p.size * 2, 0);
                ctx.lineTo(-p.size, p.size);
                ctx.lineTo(-p.size, -p.size);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        });

        ctx.restore(); // Restore to screen space for UI indicators

        // --- BOSS OFF-SCREEN INDICATOR (Skull Icon) ---
        enemies.filter(e => e.boss && !e.dead).forEach(e => {
            const scale = 0.58;
            const screenX = (e.x - camera.x) * scale + logicalWidth / 2;
            const screenY = (e.y - camera.y) * scale + logicalHeight / 2;

            const pad = 40;
            const isOffscreen = screenX < pad || screenX > logicalWidth - pad || screenY < pad || screenY > logicalHeight - pad;

            if (isOffscreen) {
                // Clamp to screen edges
                const ix = Math.max(pad, Math.min(logicalWidth - pad, screenX));
                const iy = Math.max(pad, Math.min(logicalHeight - pad, screenY));

                ctx.save();
                ctx.translate(ix, iy);

                // Pulsing Logic
                const pulse = 1 + Math.sin(Date.now() / 150) * 0.15;
                ctx.scale(pulse, pulse);

                // Draw Skull Shape
                const drawSkull = (size: number) => {
                    ctx.beginPath();
                    // Face Circle
                    ctx.arc(0, -size * 0.2, size * 0.8, 0, Math.PI * 2);
                    ctx.fill();

                    // Small Jaw Shape below
                    ctx.fillRect(-size * 0.4, size * 0.3, size * 0.8, size * 0.4);

                    // Eyes
                    ctx.fillStyle = '#000000';
                    ctx.beginPath();
                    ctx.arc(-size * 0.3, 0, size * 0.2, 0, Math.PI * 2);
                    ctx.arc(size * 0.3, 0, size * 0.2, 0, Math.PI * 2);
                    ctx.fill();

                    // Nose
                    ctx.beginPath();
                    ctx.moveTo(0, size * 0.2);
                    ctx.lineTo(-size * 0.1, size * 0.4);
                    ctx.lineTo(size * 0.1, size * 0.4);
                    ctx.closePath();
                    ctx.fill();
                };

                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ef4444';
                drawSkull(15);

                ctx.restore();
            }
        });

        // --- FULL-SCREEN SMOKE BLINDNESS EFFECT ---
        if (state.smokeBlindTime !== undefined) {
            const elapsed = state.gameTime - state.smokeBlindTime;
            const fadeIn = 0.3;
            const stay = 2.0;
            const fadeOut = 0.3;
            const total = 2.6;

            if (elapsed < total) {
                let alpha = 0;
                if (elapsed < fadeIn) alpha = elapsed / fadeIn;
                else if (elapsed < fadeIn + stay) alpha = 1;
                else alpha = 1 - (elapsed - (fadeIn + stay)) / fadeOut;

                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);

                // 1. Base Layer (5% peak as requested)
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.05})`;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                // 2. Randomized border clouds (Peak 5% effect)
                for (let i = 0; i < 20; i++) {
                    // Seed removed as it was unused and causing build error

                    let x, y;
                    if (i % 2 === 0) {
                        x = Math.random() * ctx.canvas.width;
                        y = Math.random() < 0.5 ? Math.random() * 150 : ctx.canvas.height - Math.random() * 150;
                    } else {
                        x = Math.random() < 0.5 ? Math.random() * 150 : ctx.canvas.width - Math.random() * 150;
                        y = Math.random() * ctx.canvas.height;
                    }

                    const drift = Math.sin(state.gameTime * 0.5 + i) * 60;
                    const size = 150 + Math.abs(Math.sin(i)) * 250;

                    const grad = ctx.createRadialGradient(x + drift, y + drift, 0, x + drift, y + drift, size);
                    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.1})`);
                    grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                }
                ctx.restore();
            } else {
                state.smokeBlindTime = undefined;
            }
        }
    } catch (e) {
        console.error("Render Error:", e);
    }
    // Restore context if error happened mid-save
    try { ctx.restore(); } catch (e) { }
}
