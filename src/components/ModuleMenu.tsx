
import React, { useState, useRef } from 'react';
import type { GameState, Meteorite, LegendaryHex } from '../logic/types';
import { MeteoriteTooltip } from './MeteoriteTooltip';
import { HexTooltip } from './HexTooltip';
import { HexGrid } from './modules/HexGrid';
import { InventoryPanel } from './modules/InventoryPanel';
import { getMeteoriteImage } from './modules/ModuleUtils';

interface ModuleMenuProps {
    gameState: GameState;
    isOpen: boolean;
    onClose: () => void;
    onSocketUpdate: (type: 'hex' | 'diamond', index: number, item: any) => void;
    onInventoryUpdate: (index: number, item: any) => void;
    onRecycle: (source: 'inventory' | 'diamond', index: number, amount: number) => void;
    spendDust: (amount: number) => boolean;
    triggerPortal: () => boolean;
}

export const ModuleMenu: React.FC<ModuleMenuProps> = ({ gameState, isOpen, onClose, onSocketUpdate, onInventoryUpdate, onRecycle, spendDust, triggerPortal }) => {
    const [movedItem, setMovedItem] = useState<{ item: Meteorite | any, source: 'inventory' | 'diamond' | 'hex', index: number } | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [lockedItem, setLockedItem] = useState<{ item: Meteorite | any, x: number, y: number } | null>(null);
    const [hoveredItem, setHoveredItem] = useState<{ item: Meteorite | any, x: number, y: number } | null>(null);
    const [hoveredHex, setHoveredHex] = useState<{ hex: LegendaryHex, index: number, x: number, y: number } | null>(null);

    const hoverTimeout = useRef<number | null>(null);

    const handleMouseEnterItem = (item: any, x: number, y: number) => {
        if (hoverTimeout.current) {
            clearTimeout(hoverTimeout.current);
            hoverTimeout.current = null;
        }
        setHoveredItem({ item, x, y });
    };

    const handleMouseLeaveItem = (delay: number = 300) => {
        hoverTimeout.current = window.setTimeout(() => {
            setHoveredItem(null);
            setLockedItem(null);
        }, delay);
    };

    if (!isOpen) return null;

    const { moduleSockets } = gameState;

    return (
        <div
            onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const scaleX = e.currentTarget.offsetWidth / rect.width;
                const scaleY = e.currentTarget.offsetHeight / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                setMousePos({ x, y });
            }}
            onMouseUp={() => {
                if (movedItem) {
                    // Cancel Drag / Drop back to source
                    if (movedItem.source === 'diamond') {
                        onSocketUpdate('diamond', movedItem.index, movedItem.item);
                    } else if (movedItem.source === 'inventory') {
                        onInventoryUpdate(movedItem.index, movedItem.item);
                    }
                    setMovedItem(null);
                }
            }}
            style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: 'radial-gradient(circle, rgb(10, 10, 30) 0%, rgb(2, 2, 5) 100%)',
                zIndex: 2000, color: 'white', fontFamily: 'Orbitron, sans-serif',
                overflow: 'hidden'
            }}>

            <HexGrid
                gameState={gameState}
                movedItem={movedItem}
                onSocketUpdate={onSocketUpdate}
                onInventoryUpdate={onInventoryUpdate}
                setMovedItem={setMovedItem}
                setHoveredItem={setHoveredItem} // For diamonds
                setLockedItem={setLockedItem} // For diamonds
                handleMouseEnterItem={handleMouseEnterItem}
                handleMouseLeaveItem={handleMouseLeaveItem}
                setHoveredHex={setHoveredHex} // For Hexes
            />

            <InventoryPanel
                inventory={gameState.inventory}
                meteoriteDust={gameState.player.dust}
                movedItem={movedItem}
                onInventoryUpdate={onInventoryUpdate}
                onSocketUpdate={onSocketUpdate}
                onRecycle={onRecycle}
                onClose={onClose}
                setMovedItem={setMovedItem}
                handleMouseEnterItem={handleMouseEnterItem}
                handleMouseLeaveItem={handleMouseLeaveItem}
                triggerPortal={triggerPortal}
                portalState={gameState.portalState}
            />

            {/* Ghost Item Rendering */}
            {
                movedItem && (
                    <div style={{
                        position: 'absolute',
                        top: mousePos.y,
                        left: mousePos.x,
                        width: '60px',
                        height: '60px',
                        pointerEvents: 'none',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 9999,
                        filter: 'drop-shadow(0 0 15px cyan)'
                    }}>
                        <img
                            src={getMeteoriteImage(movedItem.item)}
                            alt="moved"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                )
            }

            {/* Tooltips */}
            {(hoveredItem || lockedItem) && !movedItem && (
                <MeteoriteTooltip
                    meteorite={(lockedItem?.item || hoveredItem?.item) as Meteorite}
                    gameState={gameState}
                    x={(lockedItem || hoveredItem)!.x}
                    y={(lockedItem || hoveredItem)!.y}
                    meteoriteIdx={
                        moduleSockets.diamonds.indexOf((lockedItem?.item || hoveredItem?.item))
                    }
                    isInteractive={true}
                    onRemove={() => {
                        const target = lockedItem || hoveredItem;
                        if (!target) return false;
                        const idx = moduleSockets.diamonds.indexOf(target.item);
                        // Force Remove Logic
                        if (idx !== -1 && !movedItem) {
                            if (spendDust(5)) {
                                const item = { ...moduleSockets.diamonds[idx], isNew: false };
                                onSocketUpdate('diamond', idx, null); // Remove from socket
                                setMovedItem({ item, source: 'diamond', index: idx }); // Start Move
                                setHoveredItem(null); // Clear Tooltip
                                setLockedItem(null);
                                return true;
                            }
                        }
                        return false;
                    }}
                    canRemove={moduleSockets.diamonds.includes((lockedItem || hoveredItem)!.item)}
                    removeCost={5}
                    onMouseEnter={() => {
                        if (hoverTimeout.current) {
                            clearTimeout(hoverTimeout.current);
                            hoverTimeout.current = null;
                        }
                    }}
                    onMouseLeave={() => handleMouseLeaveItem(100)}
                />
            )}

            {hoveredHex && !movedItem && (
                <HexTooltip
                    hex={hoveredHex.hex}
                    gameState={gameState}
                    hexIdx={hoveredHex.index}
                    x={hoveredHex.x}
                    y={hoveredHex.y}
                    neighbors={[
                        moduleSockets.diamonds[hoveredHex.index],
                        moduleSockets.diamonds[(hoveredHex.index + 5) % 6],
                        moduleSockets.diamonds[hoveredHex.index + 6],
                        moduleSockets.diamonds[((hoveredHex.index + 5) % 6) + 6]
                    ]}
                />
            )}

            <style>{`
                .glow-cyan { filter: drop-shadow(0 0 10px #22d3ee); }
                .glow-yellow { filter: drop-shadow(0 0 7px rgba(250, 204, 21, 0.7)); }
                .glow-gold { filter: drop-shadow(0 0 15px #fbbf24); }
                .glow-pink { filter: drop-shadow(0 0 15px rgba(236, 72, 153, 0.9)); }
                .glow-hex { filter: drop-shadow(0 0 15px var(--hex-color)); }
                
                .pulse-gold { animation: pulseGold 1.5s infinite; }
                @keyframes pulseGold {
                    0% { opacity: 0.2; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.05); }
                    100% { opacity: 0.2; transform: scale(1); }
                }

                .pulse-purple { animation: pulsePurple 3s infinite ease-in-out; }
                .pulse-crimson { animation: pulseCrimson 3s infinite ease-in-out; }
                .synergy-trail { animation: trailPulse 3s infinite ease-in-out; }

                .pulse-slow { animation: pulseSlow 4s infinite ease-in-out; transform-box: fill-box; transform-origin: center; }
                .rotate-fast { animation: rotateFast 2s infinite linear; transform-box: fill-box; transform-origin: center; }
                
                .glow-purple { filter: drop-shadow(0 0 8px #c084fc); }
                .glow-rose { filter: drop-shadow(0 0 8px #fb7185); }
                .glow-gold { filter: drop-shadow(0 0 8px #fbbf24); }

                @keyframes pulseSlow {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.1); }
                }
                @keyframes rotateFast {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .energy-dot-forward { animation: moveDotForward 10s infinite linear; }
                .energy-dot-reverse { animation: moveDotReverse 10s infinite linear; }
                
                @keyframes moveDotForward { 0% { stroke-dashoffset: 1000; } 100% { stroke-dashoffset: 0; } }
                @keyframes moveDotReverse { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 1000; } }

                @keyframes pulsePurple {
                    0%, 100% { stroke: #A855F7; filter: drop-shadow(0 0 5px #A855F7); }
                    50% { stroke: #D8B4FE; filter: drop-shadow(0 0 20px #A855F7); }
                }
                @keyframes pulseCrimson {
                    0%, 100% { stroke: #EF4444; filter: drop-shadow(0 0 5px #EF4444); }
                    50% { stroke: #F87171; filter: drop-shadow(0 0 20px #EF4444); }
                }
                @keyframes trailPulse {
                    0%, 100% { stroke: #6366F1; filter: drop-shadow(0 0 5px #6366F1); }
                    50% { stroke: #818CF8; filter: drop-shadow(0 0 20px #6366F1); }
                }

                .pulse-cyan-glow { animation: pulseCyanGlow 2s infinite ease-in-out; }
                @keyframes pulseCyanGlow {
                    0% { stroke: #22d3ee; opacity: 0.3; filter: drop-shadow(0 0 5px #22d3ee); stroke-dashoffset: 0; }
                    50% { stroke: #ffffff; opacity: 1; filter: drop-shadow(0 0 20px #22d3ee); stroke-dashoffset: 20; }
                    100% { stroke: #22d3ee; opacity: 0.3; filter: drop-shadow(0 0 5px #22d3ee); stroke-dashoffset: 40; }
                }

                .pulse-legendary-glow { animation: pulseLegendaryGlow 2s infinite ease-in-out; }
                @keyframes pulseLegendaryGlow {
                    0% { stroke: #fbbf24; opacity: 0.3; filter: drop-shadow(0 0 5px #fbbf24); transform: scale(1); }
                    50% { stroke: #ffffff; opacity: 0.8; filter: drop-shadow(0 0 20px #fbbf24); transform: scale(1.08); }
                    100% { stroke: #fbbf24; opacity: 0.3; filter: drop-shadow(0 0 5px #fbbf24); transform: scale(1); }
                }
                @keyframes upgradePulse {
                    0% { transform: scale(1); opacity: 1; stroke-width: 2; }
                    100% { transform: scale(1.5); opacity: 0; stroke-width: 10; }
                }
                .pulse-upgrade-ring {
                    animation: upgradePulse 1s 3 linear;
                    transform-origin: center;
                    transform-box: fill-box;
                }
                @keyframes floatUpFade {
                    0% { transform: translateY(0); opacity: 1; }
                    100% { transform: translateY(-40px); opacity: 0; }
                }
                .float-up-fade {
                    animation: floatUpFade 1.5s forwards ease-out;
                }
            `}</style>
        </div>
    );
};
