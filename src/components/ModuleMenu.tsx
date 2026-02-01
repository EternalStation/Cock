
import React, { useState, useRef } from 'react';
import type { GameState, Meteorite, LegendaryHex } from '../logic/types';
import { MeteoriteTooltip } from './MeteoriteTooltip';
import { HexTooltip } from './HexTooltip';
import { HexGrid } from './modules/HexGrid';
import { InventoryPanel } from './modules/InventoryPanel';
import { getMeteoriteImage, getDustValue } from './modules/ModuleUtils';

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
    const [isRecycleMode, setIsRecycleMode] = useState(false);
    const [recyclingAnim, setRecyclingAnim] = useState(false); // Used for visual feedback on button

    // Removal Confirmation State
    const [removalCandidate, setRemovalCandidate] = useState<{ index: number, item: any } | null>(null);

    const hoverTimeout = useRef<number | null>(null);

    // Reset Recycle Mode when menu closes (because component might stay mounted but return null)
    React.useEffect(() => {
        if (!isOpen) {
            setIsRecycleMode(false);
            setRemovalCandidate(null);
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

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

    const handleAttemptRemove = (index: number, item: any) => {
        setLockedItem(null); // Clear tooltip lock so popup is visible
        setRemovalCandidate({ index, item });
    };

    const confirmRemoval = () => {
        if (removalCandidate) {
            if (spendDust(5)) {
                const { index, item } = removalCandidate;
                const newItem = { ...item, isNew: false };
                onSocketUpdate('diamond', index, null);
                setMovedItem({ item: newItem, source: 'diamond', index });
                setRemovalCandidate(null);
            } else {
                // Should show error feedback, but button should be disabled anyway
            }
        }
    };

    // Destroy Item Logic
    const handleRecycleClick = (idx: number) => {
        const item = gameState.inventory[idx];
        if (item) {
            const dustAmount = getDustValue(item.rarity);
            onRecycle('inventory', idx, dustAmount);
            // Visual feedback for successful recycle (maybe sound too if I could)
            setRecyclingAnim(true);
            setTimeout(() => setRecyclingAnim(false), 200);
        }
    };

    if (!isOpen) return null;

    const { moduleSockets } = gameState;
    const meteoriteDust = gameState.player.dust;
    const portalState = gameState.portalState;

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

            {/* MAIN LAYOUT CONTAINER */}
            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                display: 'flex', pointerEvents: 'none' // Allow clicks only on interactive elements
            }}>

                {/* LEFT: MATRIX (45%) */}
                <div style={{
                    width: '45%',
                    height: '100%',
                    position: 'relative',
                    borderRight: '2px solid rgba(59, 130, 246, 0.3)',
                    background: 'radial-gradient(circle at 60% 50%, rgba(10, 10, 30, 0.9) 0%, rgba(2, 2, 5, 0.4) 100%)',
                    pointerEvents: 'auto' // ENABLE INTERACTION FOR DRAG & DROP
                }}>
                    <HexGrid
                        gameState={gameState}
                        movedItem={movedItem}
                        onSocketUpdate={onSocketUpdate}
                        onInventoryUpdate={onInventoryUpdate}
                        setMovedItem={setMovedItem}
                        setHoveredItem={setHoveredItem}
                        setLockedItem={setLockedItem}
                        handleMouseEnterItem={handleMouseEnterItem}
                        handleMouseLeaveItem={handleMouseLeaveItem}
                        setHoveredHex={setHoveredHex}
                        onAttemptRemove={handleAttemptRemove}
                    />
                </div>

                {/* RIGHT: CONTROLS & INVENTORY (55%) */}
                <div style={{
                    width: '55%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'row', // CHANGED TO ROW
                    borderLeft: '2px solid rgba(59, 130, 246, 0.3)'
                }}>

                    {/* COL 1: DATA PANEL (TOOLTIP) - 50% */}
                    <div style={{
                        flex: 1,
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '20px',
                        background: 'radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.6) 0%, rgba(2, 2, 5, 0.2) 100%)',
                        borderRight: '1px solid rgba(59, 130, 246, 0.1)'
                    }}>
                        <div className="data-panel" style={{
                            width: '100%',
                            maxWidth: '380px',
                            height: '90%', // Increased height
                            background: 'rgba(5, 5, 15, 0.95)',
                            border: '2px solid #3b82f6',
                            borderRadius: '8px',
                            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
                            display: 'flex',
                            overflow: 'hidden'
                        }}>
                            {(hoveredItem || lockedItem) && !movedItem ? (
                                <MeteoriteTooltip
                                    meteorite={(lockedItem?.item || hoveredItem?.item) as Meteorite}
                                    gameState={gameState}
                                    x={0} y={0}
                                    meteoriteIdx={moduleSockets.diamonds.indexOf((lockedItem?.item || hoveredItem?.item))}
                                    isEmbedded={true}
                                    isInteractive={true}
                                    onMouseEnter={() => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current); }}
                                    onMouseLeave={() => handleMouseLeaveItem(100)}
                                />
                            ) : (
                                <div style={{
                                    width: '100%', height: '100%',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    color: '#3b82f6', opacity: 0.5, gap: '10px'
                                }}>
                                    <div style={{ fontSize: '30px', animation: 'spin-slow 10s infinite linear' }}>⬡</div>
                                    <div style={{ fontWeight: 900, letterSpacing: '2px' }}>SYSTEM IDLE</div>
                                    <div style={{ fontSize: '10px' }}>HOVER OVER MODULE TO SCAN</div>
                                    <style>{`@keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COL 2: CONTROLS + INVENTORY - 50% */}
                    <div style={{
                        flex: 1,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* BUTTON CLUSTER */}
                        <div style={{
                            padding: '10px 8px', // Ultra-compact padding
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '6px', // Tight gap
                            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
                            background: 'rgba(15, 23, 42, 0.3)',
                            pointerEvents: 'auto' // ADDED: Enable interactions
                        }}>
                            {/* DUST RESOURCE DISPLAY */}
                            <div style={{
                                width: '100%', maxWidth: '280px',
                                background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
                                border: '1px solid #475569',
                                borderLeft: '4px solid #22d3ee',
                                borderRadius: '4px',
                                padding: '4px 8px', // Slim padding
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                minHeight: '32px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <img src="/assets/Icons/MeteoriteDust.png" alt="Dust" style={{ width: '20px', height: '20px', filter: 'drop-shadow(0 0 5px #22d3ee)' }} />
                                    <span style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px', fontWeight: 700 }}>DUST:</span>
                                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#fff', textShadow: '0 0 10px rgba(34, 211, 238, 0.5)' }}>{meteoriteDust}</span>
                                </div>
                            </div>

                            {/* RECYCLER TOGGLE */}
                            <button
                                onClick={() => setIsRecycleMode(!isRecycleMode)}
                                style={{
                                    width: '100%', maxWidth: '280px', height: '32px', // Ultra-compact height
                                    background: isRecycleMode
                                        ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.2) 0%, rgba(153, 27, 27, 0.3) 100%)'
                                        : 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)',
                                    border: '1px solid',
                                    borderColor: isRecycleMode ? '#ef4444' : '#475569',
                                    borderRadius: '2px',
                                    position: 'relative',
                                    color: isRecycleMode ? '#ef4444' : '#94a3b8',
                                    fontSize: '10px', fontWeight: 900, letterSpacing: '1px',
                                    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    boxShadow: isRecycleMode ? '0 0 10px rgba(220, 38, 38, 0.3)' : '0 1px 2px rgba(0,0,0,0.2)',
                                    transform: recyclingAnim ? 'scale(0.98)' : 'scale(1)'
                                }}
                            >
                                <span style={{ fontSize: '12px' }}>{isRecycleMode ? '⚠' : '♻'}</span>
                                {isRecycleMode ? 'RECYCLER ACTIVE' : 'ENABLE RECYCLER'}
                            </button>

                            {/* PORTAL BUTTON */}
                            <button
                                onClick={() => triggerPortal()}
                                disabled={portalState !== 'closed' || meteoriteDust < 5}
                                style={{
                                    width: '100%', maxWidth: '280px', height: '32px', // Ultra-compact height
                                    background: portalState !== 'closed'
                                        ? 'rgba(0,0,0,0.5)'
                                        : (meteoriteDust >= 5
                                            ? 'linear-gradient(135deg, rgba(88, 28, 135, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)'
                                            : 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)'),
                                    border: '1px solid',
                                    borderColor: portalState !== 'closed'
                                        ? '#334155'
                                        : (meteoriteDust >= 5 ? '#a855f7' : '#ef4444'),
                                    borderRadius: '2px',
                                    color: portalState !== 'closed'
                                        ? '#475569'
                                        : (meteoriteDust >= 5 ? '#d8b4fe' : '#ef4444'),
                                    fontSize: '10px',
                                    fontWeight: 900,
                                    letterSpacing: '1px',
                                    textTransform: 'uppercase',
                                    cursor: (portalState === 'closed' && meteoriteDust >= 5) ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                }}
                            >
                                {portalState === 'closed' ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '12px' }}>⚛</span>
                                            PORTAL
                                        </div>
                                        <span style={{ fontSize: '8px', opacity: 0.6, background: 'rgba(0,0,0,0.3)', padding: '0px 3px', borderRadius: '2px' }}>5 DUST</span>
                                    </>
                                ) : 'PORTAL ACTIVE'}
                            </button>

                            {/* CLOSE BUTTON */}
                            <button
                                onClick={onClose}
                                style={{
                                    width: '100%', maxWidth: '280px', height: '24px', // Ultra-compact height
                                    background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                                    border: '1px solid #3b82f6',
                                    color: '#60a5fa',
                                    borderRadius: '2px',
                                    cursor: 'pointer', fontWeight: 'bold', letterSpacing: '1px',
                                    fontSize: '9px'
                                }}
                            >
                                CLOSE (ESC)
                            </button>
                        </div>

                        {/* INVENTORY PANEL - Flex 1 to take remaining space */}
                        <div style={{
                            flex: 1, // Changed from fixed height to flex 1
                            width: '100%',
                            background: 'rgba(5, 5, 15, 0.98)',
                            pointerEvents: 'auto',
                            padding: '10px',
                            borderTop: '1px solid rgba(59, 130, 246, 0.1)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{
                                width: '100%', padding: '5px 0',
                                textAlign: 'center', fontSize: '12px',
                                color: '#94a3b8', letterSpacing: '2px', fontWeight: 900
                            }}>
                                M.E.T.E.O.R. STORAGE
                            </div>
                            <InventoryPanel
                                inventory={gameState.inventory}
                                movedItem={movedItem}
                                onInventoryUpdate={onInventoryUpdate}
                                onSocketUpdate={onSocketUpdate}
                                setMovedItem={setMovedItem}
                                handleMouseEnterItem={handleMouseEnterItem}
                                handleMouseLeaveItem={handleMouseLeaveItem}
                                isRecycleMode={isRecycleMode}
                                onRecycleClick={handleRecycleClick}
                            />
                        </div>
                    </div>
                </div>
            </div>
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

            {/* REMOVAL CONFIRMATION MODAL */}
            {removalCandidate && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 2500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                    onClick={() => setRemovalCandidate(null)} // Click outside to cancel
                >
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '2px solid #ef4444',
                        padding: '20px',
                        borderRadius: '8px',
                        boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px',
                        minWidth: '300px'
                    }}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal content
                    >
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#ef4444', letterSpacing: '1px' }}>
                            UNSOCKET MODULE?
                        </div>
                        <div style={{ color: '#94a3b8', textAlign: 'center', fontSize: '12px' }}>
                            Removing this module requires energy to safely extract.
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 16px', borderRadius: '4px' }}>
                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>COST: 5</span>
                            <img src="/assets/Icons/MeteoriteDust.png" alt="Dust" style={{ width: '20px', height: '20px' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '5px' }}>
                            <button
                                onClick={() => setRemovalCandidate(null)}
                                style={{
                                    flex: 1, padding: '10px', background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid #475569', color: '#fff', borderRadius: '4px', cursor: 'pointer',
                                    fontWeight: 'bold', fontSize: '12px'
                                }}
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={confirmRemoval}
                                disabled={meteoriteDust < 5}
                                style={{
                                    flex: 1, padding: '10px',
                                    background: meteoriteDust >= 5 ? '#ef4444' : 'rgba(239, 68, 68, 0.3)',
                                    border: '1px solid #ef4444', color: meteoriteDust >= 5 ? '#fff' : '#fecaca',
                                    borderRadius: '4px', cursor: meteoriteDust >= 5 ? 'pointer' : 'not-allowed',
                                    fontWeight: 'bold', fontSize: '12px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                                }}
                            >
                                {meteoriteDust >= 5 ? 'EXTRACT' : 'NO DUST'}
                            </button>
                        </div>
                    </div>
                </div>
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
