import { useEffect, useRef } from 'react';
import type { GameState, MeteoriteRarity } from '../logic/types';
import { spawnEnemy, spawnRareEnemy } from '../logic/EnemyLogic';
import { createMeteorite } from '../logic/LootLogic';
import { castSkill } from '../logic/SkillLogic';
import { startBGM } from '../logic/AudioLogic';

interface GameInputProps {
    gameState: React.MutableRefObject<GameState>;
    setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
    setShowStats: React.Dispatch<React.SetStateAction<boolean>>;
    setShowModuleMenu: React.Dispatch<React.SetStateAction<boolean>>;
    setGameOver: React.Dispatch<React.SetStateAction<boolean>>;
    // showStats: boolean; // Removed as unused
}

export function useGameInput({ gameState, setShowSettings, setShowStats, setShowModuleMenu, setGameOver }: GameInputProps) {
    const keys = useRef<Record<string, boolean>>({});
    const inputVector = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const key = e.key.toLowerCase();
            const code = e.code.toLowerCase();

            // Start music on first interaction
            startBGM(gameState.current.currentArena);

            if (key === 'escape' || code === 'escape') {
                // Settings Menu Toggle Logic
                // If Settings is open -> Close it (Resume)
                // If Settings is closed -> Open it (Pause) - This will overlay other menus due to z-index
                setShowSettings(prev => !prev);

                // Note: We deliberately do NOT close other menus (Module/Stats) here,
                // so Settings can overlay them.
            }

            // Handle C key for stats toggle (Always allow if gameStarted or in Main Menu)
            if (key === 'c' || code === 'keyc') {
                setShowStats(prev => {
                    const next = !prev;
                    if (next) {
                        setShowSettings(false);
                        setShowModuleMenu(false);
                    }
                    return next;
                });
            }

            // Handle X key for module matrix toggle
            if (key === 'x' || code === 'keyx') {
                setShowModuleMenu(prev => {
                    const next = !prev;
                    if (next) {
                        setShowSettings(false);
                        setShowStats(false);
                        gameState.current.unseenMeteorites = 0;
                    }
                    return next;
                });
                gameState.current.showModuleMenu = !gameState.current.showModuleMenu;
            }

            // Track movement keys - use both code and key for maximum compatibility
            if (['keyw', 'keys', 'keya', 'keyd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(code)) {
                keys.current[code] = true;
                keys.current[key] = true;
            } else {
                keys.current[key] = true;
            }

            // Skill Input (1-5)
            if (['1', '2', '3', '4', '5'].includes(key)) {
                // Find skill with this keybind
                const skillIndex = gameState.current.player.activeSkills.findIndex(s => s.keyBind === key);
                if (skillIndex !== -1) {
                    castSkill(gameState.current, skillIndex);
                }
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

            // M1-M9 - Spawn Meteorite (World Spawn)
            const rarities: MeteoriteRarity[] = ['scrap', 'anomalous', 'quantum', 'astral', 'radiant', 'void', 'eternal', 'divine', 'singularity'];
            for (let i = 1; i <= 9; i++) {
                if (cheatBuffer.endsWith(`m${i}`)) {
                    const player = gameState.current.player;
                    // Random position within 300 units
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 50 + Math.random() * 250;
                    const x = player.x + Math.cos(angle) * dist;
                    const y = player.y + Math.sin(angle) * dist;

                    const met = createMeteorite(gameState.current, rarities[i - 1], x, y);
                    gameState.current.meteorites.push(met);
                    cheatBuffer = '';
                }
            }

            if (cheatBuffer.endsWith('por')) {
                // Trigger Portal Sequence (10s warning then open)
                gameState.current.portalState = 'closed';
                gameState.current.portalTimer = 10.1; // Slightly above 10 to ensure clean transition
                cheatBuffer = '';
            }

            // Z1 - Spawn Friendly Zombie
            if (cheatBuffer.endsWith('z1')) {
                const p = gameState.current.player;
                const zombie = {
                    id: Math.random(),
                    x: p.x + 100,
                    y: p.y + 100,
                    size: 20,
                    hp: 500, // Balanced testing HP
                    maxHp: 500,
                    dead: false,
                    isZombie: true,
                    zombieState: 'dead',
                    zombieTimer: gameState.current.gameTime * 1000 + 5000,
                    zombieSpd: 1.92,
                    vx: 0,
                    vy: 0,
                    palette: ['#4ade80', '#22c55e', '#166534'],
                    shape: 'circle',
                    knockback: { x: 0, y: 0 }
                };
                gameState.current.enemies.push(zombie as any);
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
    }, []);

    const handleJoystickInput = (x: number, y: number) => {
        inputVector.current = { x, y };
    };

    return { keys, inputVector, handleJoystickInput };
}
