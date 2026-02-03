
import React from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';
import { calcStat } from '../logic/MathUtils';
import { getArenaIndex } from '../logic/MapLogic';
import { Minimap } from './Minimap';

import { TopLeftPanel } from './hud/TopLeftPanel';
import { BottomRightPanel } from './hud/BottomRightPanel';
import { AlertPanel } from './hud/AlertPanel';
import { PlayerStatus } from './hud/PlayerStatus';
import { BossStatus } from './hud/BossStatus';
import { UpgradeMenu } from './hud/UpgradeMenu';
import { getKeybinds, getKeyDisplay } from '../logic/Keybinds';


interface HUDProps {
    gameState: GameState;
    upgradeChoices: UpgradeChoice[] | null;
    onUpgradeSelect: (c: UpgradeChoice) => void;
    gameOver: boolean;
    onRestart: () => void;
    bossWarning: number | null;
    fps: number;
    onInventoryToggle: () => void;
    portalError: boolean;
}

export const HUD: React.FC<HUDProps> = ({ gameState, upgradeChoices, onUpgradeSelect, gameOver, bossWarning, fps, onInventoryToggle, portalError }) => {
    const { player, activeEvent } = gameState;

    // Dynamic Max HP calculation for HUD
    let maxHp = calcStat(player.hp);
    if (getArenaIndex(player.x, player.y) === 2) {
        maxHp *= 1.2; // +20% Max HP in Defence Hex
    }

    if (gameOver) return null;

    // Calculate time remaining for active event
    const timeRemaining = activeEvent ? Math.ceil(activeEvent.endTime - gameState.gameTime) : 0;

    return (
        <>
            {/* Event Screen Effects */}
            {activeEvent?.type === 'red_moon' && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle at center, rgba(127, 29, 29, 0.35) 0%, rgba(185, 28, 28, 0.15) 100%)',
                    pointerEvents: 'none',
                    zIndex: 5,
                    animation: 'redPulse 2s ease-in-out infinite'
                }} />
            )}
            {activeEvent?.type === 'necrotic_surge' && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle at center, rgba(87, 83, 78, 0.25) 0%, rgba(120, 113, 108, 0.15) 50%, rgba(127, 29, 29, 0.2) 100%)',
                    pointerEvents: 'none',
                    zIndex: 5,
                    animation: 'glitchEffect 0.3s ease-in-out infinite'
                }} />
            )}

            {/* Event Indicator */}
            {activeEvent && (
                <div style={{
                    position: 'absolute',
                    top: '15%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    zIndex: 200
                }}>
                    <div style={{
                        fontSize: 32,
                        fontWeight: 'bold',
                        color: activeEvent.type === 'red_moon' ? '#ef4444' : '#a8a29e',
                        textShadow: activeEvent.type === 'red_moon'
                            ? '0 0 25px rgba(239, 68, 68, 0.9), 0 0 50px rgba(185, 28, 28, 0.5)'
                            : '0 0 15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(87, 83, 78, 0.6)',
                        letterSpacing: 3,
                        marginBottom: 10,
                        animation: activeEvent.type === 'necrotic_surge' ? 'glitchText 0.5s ease-in-out infinite' : 'none'
                    }}>
                        {activeEvent.type === 'red_moon' && 'BLOOD MOON'}
                        {activeEvent.type === 'necrotic_surge' && 'NECROTIC SURGE'}
                    </div>
                    <div style={{
                        fontSize: 20,
                        color: '#ffffff',
                        textShadow: '0 0 12px rgba(0, 0, 0, 0.95)',
                        fontWeight: 700,
                        letterSpacing: 1
                    }}>
                        SURVIVE: {timeRemaining}s
                    </div>
                </div>
            )}

            <TopLeftPanel gameState={gameState} />
            <BottomRightPanel
                onInventoryToggle={onInventoryToggle}
                unseenMeteorites={gameState.inventory.filter(i => i?.isNew).length}
                fps={fps}
                portalKey={getKeyDisplay(getKeybinds().portal)}
                portalState={gameState.portalState}
                dust={gameState.player.dust}
                portalError={portalError}
            />
            <AlertPanel gameState={gameState} bossWarning={bossWarning} />

            {/* XP Bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 6, background: '#000', zIndex: 100 }}>
                <div style={{
                    width: `${(player.xp.current / player.xp.needed) * 100}%`,
                    height: '100%',
                    background: '#4ade80',
                    boxShadow: '0 0 15px #4ade80',
                    transition: 'width 0.2s'
                }} />
            </div>

            <BossStatus gameState={gameState} />

            <PlayerStatus gameState={gameState} maxHp={maxHp} />

            <Minimap gameState={gameState} />

            {upgradeChoices && (
                <UpgradeMenu
                    upgradeChoices={upgradeChoices}
                    onUpgradeSelect={onUpgradeSelect}
                    gameState={gameState}
                />
            )}

            {/* CSS Animations */}
            <style>{`
                @keyframes redPulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 0.8; }
                }
                @keyframes glitchEffect {
                    0%, 100% { opacity: 1; }
                    25% { opacity: 0.8; transform: translate(-2px, 2px); }
                    50% { opacity: 0.9; transform: translate(2px, -2px); }
                    75% { opacity: 0.85; transform: translate(-1px, 1px); }
                }
                @keyframes glitchText {
                    0%, 100% { transform: translate(0, 0); }
                    25% { transform: translate(-2px, 1px); }
                    50% { transform: translate(2px, -1px); }
                    75% { transform: translate(-1px, 2px); }
                }
            `}</style>
        </>
    );
};
