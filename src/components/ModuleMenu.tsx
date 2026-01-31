import React, { useState, useRef } from 'react';
import type { GameState, Meteorite, MeteoriteRarity, LegendaryHex, LegendaryCategory } from '../logic/types';
import { calculateMeteoriteEfficiency } from '../logic/EfficiencyLogic';
import { MeteoriteTooltip } from './MeteoriteTooltip';
import { HexTooltip } from './HexTooltip';

interface ModuleMenuProps {
    gameState: GameState;
    isOpen: boolean;
    onClose: () => void;
    onSocketUpdate: (type: 'hex' | 'diamond', index: number, item: any) => void;
    onInventoryUpdate: (index: number, item: any) => void;
    onRecycle: (source: 'inventory' | 'diamond', index: number, amount: number) => void;
    spendDust: (amount: number) => boolean;
}

const RARITY_COLORS: Record<MeteoriteRarity, string> = {
    scrap: '#7FFF00',
    anomalous: '#00C0C0',
    quantum: '#00FFFF',
    astral: '#7B68EE',
    radiant: '#FFD700',
    void: '#8B0000',
    eternal: '#B8860B',
    divine: '#FFFFFF',
    singularity: '#E942FF'
};

// Rarity Order for Dust Value (1 to 9)
const RARITY_ORDER: MeteoriteRarity[] = ['scrap', 'anomalous', 'quantum', 'astral', 'radiant', 'void', 'eternal', 'divine', 'singularity'];

const getDustValue = (rarity: MeteoriteRarity) => {
    // 1-Based Dust Value based on Rarity Index
    return RARITY_ORDER.indexOf(rarity) + 1;
};

const getMeteoriteImage = (m: Meteorite) => {
    return `/assets/meteorites/M${m.visualIndex}${m.quality}.png`;
};

export const ModuleMenu: React.FC<ModuleMenuProps> = ({ gameState, isOpen, onClose, onSocketUpdate, onInventoryUpdate, onRecycle, spendDust }) => {
    const [movedItem, setMovedItem] = useState<{ item: Meteorite | any, source: 'inventory' | 'diamond' | 'hex', index: number } | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [lockedItem, setLockedItem] = useState<{ item: Meteorite | any, x: number, y: number } | null>(null);
    const [hoveredItem, setHoveredItem] = useState<{ item: Meteorite | any, x: number, y: number } | null>(null);
    const [hoveredHex, setHoveredHex] = useState<{ hex: LegendaryHex, index: number, x: number, y: number } | null>(null);
    const [recyclingAnim, setRecyclingAnim] = useState(false);

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

    const { moduleSockets, inventory, meteoriteDust } = gameState;
    const centerX = 540;
    const centerY = 540;
    const innerRadius = 170;
    const outerRadius = 260;

    const edgeRadius = 350;

    const getHexPoints = (x: number, y: number, r: number) => {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            points.push(`${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`);
        }
        return points.join(' ');
    };

    const hexPositions = Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i;
        const pos = { x: centerX + outerRadius * Math.cos(angle), y: centerY + outerRadius * Math.sin(angle) };
        const vertices = Array.from({ length: 6 }).map((_, vIdx) => {
            const vAngle = (Math.PI / 3) * vIdx - Math.PI / 2;
            return { x: pos.x + 60 * Math.cos(vAngle), y: pos.y + 60 * Math.sin(vAngle) };
        });
        return { ...pos, vertices };
    });

    const innerDiamondPositions = Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        const pos = { x: centerX + innerRadius * Math.cos(angle), y: centerY + innerRadius * Math.sin(angle) };
        const vertices = [
            { x: 40, y: 0 },
            { x: 0, y: 40 },
            { x: -40, y: 0 },
            { x: 0, y: -40 }
        ].map(v => {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return {
                x: pos.x + (v.x * cos - v.y * sin),
                y: pos.y + (v.x * sin + v.y * cos)
            };
        });
        return { ...pos, vertices, angle };
    });

    const edgeDiamondPositions = Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        const pos = { x: centerX + edgeRadius * Math.cos(angle), y: centerY + edgeRadius * Math.sin(angle) };
        const vertices = [
            { x: 40, y: 0 },
            { x: 0, y: 40 },
            { x: -40, y: 0 },
            { x: 0, y: -40 }
        ].map(v => {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return {
                x: pos.x + (v.x * cos - v.y * sin),
                y: pos.y + (v.x * sin + v.y * cos)
            };
        });
        return { ...pos, vertices, angle };
    });

    const centerSideMidpoints = Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        return { x: centerX + 69.28 * Math.cos(angle), y: centerY + 69.28 * Math.sin(angle) };
    });

    const allDiamondPositions = [...innerDiamondPositions, ...edgeDiamondPositions];
    const INACTIVE_STROKE = "rgba(74, 85, 104, 0.2)";

    const findClosestVertices = (v1s: { x: number, y: number }[], v2s: { x: number, y: number }[]) => {
        let minVal = Infinity;
        let bestPair = { v1: v1s[0], v2: v2s[0] };
        v1s.forEach(v1 => {
            v2s.forEach(v2 => {
                const d = (v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2;
                if (d < minVal) {
                    minVal = d;
                    bestPair = { v1, v2 };
                }
            });
        });
        return bestPair;
    };

    const getLegendaryInfo = (category: string, type: string) => {
        const categories: Record<LegendaryCategory, { icon: string, color: string }> = {
            Economic: { icon: '💰', color: '#fbbf24' },
            Combat: { icon: '⚔️', color: '#f87171' },
            Defensive: { icon: '🛡️', color: '#60a5fa' }
        };
        const base = categories[category as LegendaryCategory] || { icon: '★', color: '#fbbf24' };

        // For type-specific icons (overrides)
        switch (type) {
            case 'hp_per_kill': return { ...base, icon: '✚' };
            case 'ats_per_kill': return { ...base, icon: '⚡' };
            case 'xp_per_kill': return { ...base, icon: '✨' };
            case 'dmg_per_kill': return { ...base, icon: '⚔' };
            case 'reg_per_kill': return { ...base, icon: '❤' };
            case 'shockwave': return { ...base, icon: '🌊' };
            case 'shield_passive': return { ...base, icon: '🛡️' };
            case 'dash_boost': return { ...base, icon: '💨' };
            case 'lifesteal': return { ...base, icon: '🩸' };
            case 'orbital_strike': return { ...base, icon: '🛰️' };
            case 'drone_overdrive': return { ...base, icon: '🤖' };
            default: return base;
        }
    };

    return (
        <div
            onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setMousePos({ x, y });
            }}
            onClick={() => {
                // Global Drop Cancel or handle drop if clicked empty space?
                // Actually, let's keep it simple. Clicking empty space does nothing or drops back to source?
                // User didn't specify. Let's stick to click-target logic.
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
            <svg width="100%" height="100%" viewBox="0 0 1920 1080">
                <text x={centerX} y={centerY - 480} textAnchor="middle" fill="#22d3ee" fontSize="32" fontWeight="900" style={{ letterSpacing: '8px', opacity: 0.8 }}>MODULE MATRIX</text>
                <text x={centerX} y={centerY - 440} textAnchor="middle" fill="#94a3b8" fontSize="12" style={{ letterSpacing: '2px', opacity: 0.6 }}>CONSTRUCT SYNERGIES BY SLOTTING METEORITES AND RECOVERED MODULES</text>
                <line x1={centerX - 250} y1={centerY - 425} x2={centerX + 250} y2={centerY - 425} stroke="#22d3ee" strokeWidth="1" opacity="0.2" />



                {/* 2. MS LINES (Met-Met) */}
                {/* 2.1 Inner-Inner Adjacent (6) */}
                {innerDiamondPositions.map((pos, i) => {
                    const nextPos = innerDiamondPositions[(i + 1) % 6];
                    const active = moduleSockets.diamonds[i] && moduleSockets.diamonds[(i + 1) % 6];
                    const v1 = pos;
                    const v2 = nextPos;
                    return (
                        <g key={`ms-ii-adj-group-${i}`}>
                            <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke={active ? "#EF4444" : INACTIVE_STROKE} strokeWidth={active ? "3" : "2"} opacity={active ? 0.3 : 1} className={active ? "pulse-crimson" : ""} />
                            {active && (
                                <>
                                    <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#F87171" strokeWidth="5" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#F87171" strokeWidth="5" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>
                    );
                })}
                {/* 2.2 Inner-Inner Opposite (3) */}
                {innerDiamondPositions.slice(0, 3).map((pos, i) => {
                    const oppIdx = i + 3;
                    const oppPos = innerDiamondPositions[oppIdx];
                    const active = moduleSockets.diamonds[i] && moduleSockets.diamonds[oppIdx];
                    const v1 = pos;
                    const v2 = oppPos;
                    return (
                        <g key={`ms-ii-opp-group-${i}`}>
                            <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke={active ? "#EF4444" : INACTIVE_STROKE} strokeWidth={active ? "3" : "2"} opacity={active ? 0.3 : 1} className={active ? "pulse-crimson" : ""} />
                            {active && (
                                <>
                                    <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#F87171" strokeWidth="5" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#F87171" strokeWidth="5" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>
                    );
                })}
                {/* 2.3 Inner-Outer Radial (6) */}
                {edgeDiamondPositions.map((ePos, i) => {
                    const iPos = innerDiamondPositions[i];
                    const active = moduleSockets.diamonds[i + 6] && moduleSockets.diamonds[i];
                    const v1 = ePos;
                    const v2 = iPos;
                    return (
                        <g key={`ms-io-rad-group-${i}`}>
                            <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke={active ? "#EF4444" : INACTIVE_STROKE} strokeWidth={active ? "3" : "2"} opacity={active ? 0.3 : 1} className={active ? "pulse-crimson" : ""} />
                            {active && (
                                <>
                                    <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#F87171" strokeWidth="5" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y} stroke="#F87171" strokeWidth="5" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>
                    );
                })}

                {/* 3. XMS LINES (Hex-Met) */}
                {/* 3.1 Center-Inner Perpendicular (6) */}
                {innerDiamondPositions.map((pos, i) => {
                    const active = moduleSockets.diamonds[i];
                    const mid = centerSideMidpoints[i];
                    const targetV = pos;
                    return (
                        <g key={`xms-ci-perp-group-${i}`}>
                            <line x1={mid.x} y1={mid.y} x2={targetV.x} y2={targetV.y} stroke={active ? "#6366F1" : INACTIVE_STROKE} strokeWidth={active ? "2" : "1"} opacity={active ? 0.3 : 1} className={active ? "synergy-trail" : ""} />
                            {active && (
                                <>
                                    <line x1={mid.x} y1={mid.y} x2={targetV.x} y2={targetV.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={mid.x} y1={mid.y} x2={targetV.x} y2={targetV.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>
                    );
                })}
                {/* 3.2 OuterHex-InnerMet (12) */}
                {hexPositions.map((hPos, i) => {
                    const dIdx1 = i;
                    const dIdx2 = (i + 5) % 6;
                    const active1 = moduleSockets.hexagons[i] && moduleSockets.diamonds[dIdx1];
                    const active2 = moduleSockets.hexagons[i] && moduleSockets.diamonds[dIdx2];
                    const dPos1 = innerDiamondPositions[dIdx1];
                    const dPos2 = innerDiamondPositions[dIdx2];
                    const pair1 = findClosestVertices(hPos.vertices, [dPos1]);
                    const pair2 = findClosestVertices(hPos.vertices, [dPos2]);
                    return [
                        <g key={`xms-hi-group-${i}-1`}>
                            <line x1={pair1.v1.x} y1={pair1.v1.y} x2={pair1.v2.x} y2={pair1.v2.y} stroke={active1 ? "#6366F1" : INACTIVE_STROKE} strokeWidth={active1 ? "2" : "1"} opacity={active1 ? 0.3 : 1} className={active1 ? "synergy-trail" : ""} />
                            {active1 && (
                                <>
                                    <line x1={pair1.v1.x} y1={pair1.v1.y} x2={pair1.v2.x} y2={pair1.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={pair1.v1.x} y1={pair1.v1.y} x2={pair1.v2.x} y2={pair1.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>,
                        <g key={`xms-hi-group-${i}-2`}>
                            <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke={active2 ? "#6366F1" : INACTIVE_STROKE} strokeWidth={active2 ? "2" : "1"} opacity={active2 ? 0.3 : 1} className={active2 ? "synergy-trail" : ""} />
                            {active2 && (
                                <>
                                    <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>
                    ];
                })}
                {/* 3.3 OuterHex-EdgeMet (12) */}
                {hexPositions.map((hPos, i) => {
                    const eIdx1 = i;
                    const eIdx2 = (i + 5) % 6;
                    const active1 = moduleSockets.hexagons[i] && moduleSockets.diamonds[eIdx1 + 6];
                    const active2 = moduleSockets.hexagons[i] && moduleSockets.diamonds[eIdx2 + 6];
                    const ePos1 = edgeDiamondPositions[eIdx1];
                    const ePos2 = edgeDiamondPositions[eIdx2];
                    const pair1 = findClosestVertices(hPos.vertices, [ePos1]);
                    const pair2 = findClosestVertices(hPos.vertices, [ePos2]);
                    return [
                        <g key={`xms-he-group-${i}-1`}>
                            <line x1={pair1.v1.x} y1={pair1.v1.y} x2={pair1.v2.x} y2={pair1.v2.y} stroke={active1 ? "#6366F1" : INACTIVE_STROKE} strokeWidth={active1 ? "2" : "1"} opacity={active1 ? 0.4 : 1} className={active1 ? "synergy-trail" : ""} />
                            {active1 && (
                                <>
                                    <line x1={pair1.v1.x} y1={pair1.v1.y} x2={pair1.v2.x} y2={pair1.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={pair1.v1.x} y1={pair1.v1.y} x2={pair1.v2.x} y2={pair1.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>,
                        <g key={`xms-he-group-${i}-2`}>
                            <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke={active2 ? "#6366F1" : INACTIVE_STROKE} strokeWidth={active2 ? "2" : "1"} opacity={active2 ? "0.4" : 1} className={active2 ? "synergy-trail" : ""} />
                            {active2 && (
                                <>
                                    <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>
                    ];
                })}

                <defs>
                    <radialGradient id="hp-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#7f1d1d" />
                    </radialGradient>
                    <radialGradient id="socket-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(2, 6, 23, 0.95)" />
                        <stop offset="70%" stopColor="rgba(15, 23, 42, 0.6)" />
                        <stop offset="100%" stopColor="rgba(30, 41, 59, 0.2)" />
                    </radialGradient>
                    <radialGradient id="core-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgb(15, 23, 42)" />
                        <stop offset="100%" stopColor="rgb(2, 6, 23)" />
                    </radialGradient>
                    <filter id="rugged-rim">
                        <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="3" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
                    </filter>
                </defs>

                <polygon
                    points={getHexPoints(centerX, centerY, 80)}
                    fill="url(#core-grad)"
                    stroke="#22d3ee"
                    strokeWidth="4"
                    className="glow-cyan"
                />

                {hexPositions.map((pos, i) => {
                    const hex = gameState.moduleSockets.hexagons[i];
                    const info = hex ? getLegendaryInfo(hex.category, hex.type) : null;
                    return (
                        <g key={`hex-socket-${i}`}
                            onClick={() => {
                                if (gameState.pendingLegendaryHex && !hex) {
                                    onSocketUpdate('hex', i, { ...gameState.pendingLegendaryHex });
                                }
                            }}
                            onMouseMove={(e) => {
                                if (hex && !movedItem) {
                                    setHoveredHex({ hex, index: i, x: e.clientX, y: e.clientY });
                                }
                            }}
                            onMouseLeave={() => setHoveredHex(null)}
                            onDragOver={(e) => e.preventDefault()}
                            style={{ cursor: (gameState.pendingLegendaryHex && !hex) ? 'copy' : (hex ? 'help' : 'default') }}
                        >
                            <polygon
                                points={getHexPoints(pos.x, pos.y, 60)}
                                fill="url(#core-grad)"
                                stroke={hex ? info?.color : "rgba(250, 204, 21, 0.5)"}
                                strokeWidth={hex ? "4" : "2"}
                                className={hex ? "glow-hex" : "glow-yellow"}
                                style={{ '--hex-color': info?.color } as any}
                            />
                            {hex && (
                                <g>
                                    {hex.customIcon ? (
                                        <image
                                            href={hex.customIcon}
                                            x={pos.x - 60}
                                            y={pos.y - 60}
                                            width="120"
                                            height="120"
                                            style={{ imageRendering: 'pixelated', filter: `drop-shadow(0 0 15px ${info?.color}88)` }}
                                            pointerEvents="none"
                                        />
                                    ) : (
                                        <text x={pos.x} y={pos.y - 5} textAnchor="middle" fill={info?.color} fontSize="28" style={{ filter: `drop-shadow(0 0 8px ${info?.color})`, fontWeight: 900 }} pointerEvents="none">
                                            {info?.icon}
                                        </text>
                                    )}
                                    <rect x={pos.x - 28} y={pos.y + 40} width="56" height="18" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke={info?.color} strokeWidth="2" pointerEvents="none" />
                                    <text x={pos.x} y={pos.y + 53} textAnchor="middle" fill={hex.level === 5 ? "#FCD34D" : info?.color} fontSize="12" fontWeight="900" pointerEvents="none" style={{ letterSpacing: '1px' }}>
                                        {hex.level === 5 ? "MAX" : `LVL ${hex.level}`}
                                    </text>
                                    {gameState.upgradingHexIndex === i && gameState.upgradingHexTimer > 0 && (
                                        <g>
                                            <polygon
                                                points={getHexPoints(pos.x, pos.y, 52.5)}
                                                fill="none"
                                                stroke="#fbbf24"
                                                strokeWidth="3"
                                                className="pulse-upgrade-ring"
                                                style={{ pointerEvents: 'none' }}
                                            />
                                            <text
                                                x={pos.x}
                                                y={pos.y - 80}
                                                textAnchor="middle"
                                                fill="#fbbf24"
                                                fontSize="24"
                                                fontWeight="900"
                                                className="float-up-fade"
                                                style={{ textShadow: '0 0 10px #fbbf24' }}
                                            >
                                                UPGRADED!
                                            </text>
                                        </g>
                                    )}
                                    {hex.level === 5 && (
                                        <circle cx={pos.x} cy={pos.y} r="55" fill="none" stroke="#FCD34D" strokeWidth="2" strokeDasharray="4 4" className="spin-slow" pointerEvents="none" />
                                    )}
                                </g>
                            )}
                            {gameState.pendingLegendaryHex && !hex && (
                                <polygon
                                    points={getHexPoints(pos.x, pos.y, 68)}
                                    fill="rgba(251, 191, 36, 0.05)"
                                    stroke="#fbbf24"
                                    strokeWidth="2"
                                    style={{ pointerEvents: 'none', transformBox: 'fill-box', transformOrigin: 'center' }}
                                    className="pulse-legendary-glow"
                                />
                            )}
                        </g>
                    );
                })}

                {allDiamondPositions.map((pos, i) => (
                    <g key={`diamond-socket-${i}`}
                        onClick={(e) => {
                            // Only Click-Lock tooltip if not dragging
                            if (!movedItem) {
                                setLockedItem({ item: moduleSockets.diamonds[i], x: e.clientX, y: e.clientY });
                            }
                        }}
                        onMouseUp={(e) => {
                            e.stopPropagation();
                            if (movedItem) {
                                // Handle Drop on Socket from Release
                                if (movedItem.source === 'inventory') {
                                    const itemAtTarget = moduleSockets.diamonds[i];
                                    onSocketUpdate('diamond', i, movedItem.item);
                                    onInventoryUpdate(movedItem.index, itemAtTarget);
                                } else if (movedItem.source === 'diamond') {
                                    // Swap or Move
                                    const itemAtTarget = moduleSockets.diamonds[i];
                                    onSocketUpdate('diamond', i, movedItem.item);
                                    onSocketUpdate('diamond', movedItem.index, itemAtTarget);
                                }
                                setMovedItem(null);
                                setHoveredItem(null);
                                setLockedItem(null);
                            }
                        }}
                    >
                        {movedItem && !moduleSockets.diamonds[i] && (
                            <circle
                                cx={pos.x} cy={pos.y} r="50"
                                fill="none"
                                stroke="#22d3ee"
                                strokeWidth="3"
                                strokeDasharray="8 6"
                                className="pulse-cyan-glow"
                                pointerEvents="none"
                            />
                        )}
                        <circle cx={pos.x} cy={pos.y} r="40" fill="none" stroke="rgba(236, 72, 153, 0.4)" strokeWidth="2" filter="url(#rugged-rim)" className="glow-pink" />
                        <circle cx={pos.x} cy={pos.y} r="35" fill="url(#socket-grad)" stroke="rgba(236, 72, 153, 0.25)" strokeWidth="1" filter="url(#rugged-rim)" />
                        <circle cx={pos.x} cy={pos.y} r="25" fill="rgba(0,0,0,0.3)" />

                        {moduleSockets.diamonds[i] && (
                            <>
                                <foreignObject x={pos.x - 35} y={pos.y - 35} width="70" height="70" style={{ pointerEvents: 'none' }}>
                                    <div
                                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onMouseMove={(e) => {
                                            const item = moduleSockets.diamonds[i];
                                            if (item && !movedItem) {
                                                handleMouseEnterItem(item, e.clientX, e.clientY);
                                                if (item.isNew) {
                                                    item.isNew = false;
                                                    onSocketUpdate('diamond', i, item);
                                                }
                                            }
                                        }}
                                        onMouseDown={(e) => {
                                            if (e.button === 0 && !movedItem) {
                                                const item = moduleSockets.diamonds[i];
                                                if (item) {
                                                    // Allow direct dragging
                                                    onSocketUpdate('diamond', i, null);
                                                    setMovedItem({ item, source: 'diamond', index: i });
                                                    setHoveredItem(null);
                                                }
                                            }
                                        }}
                                        onMouseLeave={() => handleMouseLeaveItem(100)}
                                    >
                                        {moduleSockets.diamonds[i]?.isNew && (
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                right: 0,
                                                background: '#ef4444',
                                                color: 'white',
                                                fontSize: '8px',
                                                fontWeight: 900,
                                                padding: '2px 4px',
                                                borderRadius: '4px',
                                                boxShadow: '0 0 10px #ef4444',
                                                zIndex: 10,
                                                pointerEvents: 'none',
                                                animation: 'pulse-red 1s infinite'
                                            }}>
                                                NEW
                                            </div>
                                        )}
                                        <img
                                            src={getMeteoriteImage(moduleSockets.diamonds[i]!)}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'contain',
                                                pointerEvents: 'auto', // Allow mouse events for hover
                                                cursor: movedItem ? 'copy' : 'default' // Indicate valid drop target
                                            }}
                                            alt="meteorite"
                                        />
                                    </div>
                                </foreignObject>

                                {/* SVG-based Efficiency Label (to avoid clipping) */}
                                <g pointerEvents="none">
                                    <rect
                                        x={pos.x - 32}
                                        y={pos.y + 25}
                                        width="64"
                                        height="18"
                                        rx="4"
                                        fill="rgba(15, 23, 42, 0.98)"
                                        stroke={RARITY_COLORS[moduleSockets.diamonds[i]!.rarity]}
                                        strokeWidth="1.5"
                                        style={{ filter: `drop-shadow(0 0 8px ${RARITY_COLORS[moduleSockets.diamonds[i]!.rarity]}66)` }}
                                    />
                                    <text
                                        x={pos.x}
                                        y={pos.y + 38}
                                        textAnchor="middle"
                                        fill={RARITY_COLORS[moduleSockets.diamonds[i]!.rarity]}
                                        fontSize="11"
                                        fontWeight="900"
                                        style={{ letterSpacing: '0.5px' }}
                                    >
                                        +{Math.round(calculateMeteoriteEfficiency(gameState, i).totalBoost * 100)}%
                                    </text>
                                </g>
                            </>
                        )}
                    </g>
                ))}
            </svg>

            <div style={{
                position: 'absolute', right: 0, top: 0, height: '100%', width: '450px',
                background: 'rgba(5, 5, 15, 0.98)', borderLeft: '4px solid #3b82f6',
                padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px',
                backdropFilter: 'blur(30px)', boxShadow: '-30px 0 60px rgba(0,0,0,0.9)'
            }}>
                <h2 style={{ color: '#22d3ee', margin: '0 0 5px 0', fontSize: '1.5rem', letterSpacing: '4px', textAlign: 'center' }}>INVENTORY</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', alignContent: 'start', overflowY: 'auto', maxHeight: '500px', paddingRight: '5px' }}>
                    {inventory.map((item, idx) => (
                        <div key={idx}
                            onClick={() => {
                                // No click-to-move
                            }}
                            onMouseMove={(e) => {
                                if (item && !movedItem) {
                                    handleMouseEnterItem(item, e.clientX, e.clientY);
                                    if (item.isNew) {
                                        item.isNew = false;
                                        onInventoryUpdate(idx, item);
                                    }
                                }
                            }}
                            onMouseLeave={() => handleMouseLeaveItem(0)}
                            onMouseDown={(e) => {
                                if (e.button === 0 && item && !movedItem) {
                                    // Drag Start logic
                                    onInventoryUpdate(idx, null); // Remove from inventory visual
                                    setMovedItem({ item, source: 'inventory', index: idx });
                                    setHoveredItem(null);
                                }
                            }}
                            onMouseUp={(e) => {
                                e.stopPropagation();
                                if (movedItem) {
                                    // Drop Logic (Inventory Target)
                                    if (movedItem.source === 'diamond') {
                                        const itemAtTarget = inventory[idx];
                                        onInventoryUpdate(idx, movedItem.item);
                                        onSocketUpdate('diamond', movedItem.index, itemAtTarget);
                                    } else if (movedItem.source === 'inventory') {
                                        const itemAtTarget = inventory[idx];
                                        onInventoryUpdate(idx, movedItem.item);
                                        onInventoryUpdate(movedItem.index, itemAtTarget);
                                    }
                                    setMovedItem(null);
                                    setHoveredItem(null);
                                    setLockedItem(null);
                                }
                            }}
                            style={{
                                width: '100%', height: '70px', background: '#0f172a',
                                border: `2px solid ${movedItem?.index === idx && movedItem.source === 'inventory' ? '#3b82f6' : (item ? RARITY_COLORS[item.rarity] : '#1e293b')}`,
                                borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                position: 'relative',
                                cursor: 'pointer',
                                opacity: movedItem?.index === idx && movedItem.source === 'inventory' ? 0.3 : 1
                            }}>
                            {item?.isNew && (
                                <div style={{
                                    position: 'absolute',
                                    top: '-5px',
                                    right: '-5px',
                                    background: '#ef4444',
                                    color: 'white',
                                    fontSize: '8px',
                                    fontWeight: 900,
                                    padding: '2px 4px',
                                    borderRadius: '4px',
                                    boxShadow: '0 0 10px #ef4444',
                                    zIndex: 10,
                                    animation: 'pulse-red 1s infinite'
                                }}>
                                    NEW
                                </div>
                            )}
                            {item && (
                                <img
                                    src={getMeteoriteImage(item)}
                                    style={{
                                        width: '80%',
                                        height: '80%',
                                        objectFit: 'contain',
                                        pointerEvents: 'none'
                                    }}
                                    alt="meteorite"
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* RECYCLER SECTION */}
                <div style={{ marginTop: '20px', borderTop: '1px solid #3b82f6', paddingTop: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                        <h2 style={{ color: '#ef4444', margin: 0, fontSize: '1.2rem', letterSpacing: '4px' }}>RECYCLER</h2>
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '12px', border: '1px solid #475569' }}>
                            <img src="/assets/Icons/MeteoriteDust.png" alt="Dust" style={{ width: '24px', height: '24px', marginRight: '6px' }} />
                            <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>{meteoriteDust}</span>
                        </div>
                    </div>

                    <div
                        onMouseUp={(e) => {
                            e.stopPropagation();
                            if (movedItem) {
                                const dustAmount = getDustValue(movedItem.item.rarity);
                                const source = movedItem.source === 'inventory' ? 'inventory' : (movedItem.source === 'diamond' ? 'diamond' : null);

                                if (source) {
                                    onRecycle(source, movedItem.index, dustAmount);
                                    setRecyclingAnim(true);
                                    setTimeout(() => setRecyclingAnim(false), 500);
                                    setMovedItem(null);
                                }
                            }
                        }}
                        style={{
                            width: '100%',
                            height: '80px',
                            background: recyclingAnim ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.5)',
                            border: `2px dashed ${recyclingAnim ? '#ffffff' : '#ef4444'}`,
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444',
                            fontSize: '10px',
                            letterSpacing: '2px',
                            transition: 'all 0.1s',
                            cursor: movedItem ? 'copy' : 'default',
                            transform: recyclingAnim ? 'scale(0.98)' : 'scale(1)',
                            boxShadow: recyclingAnim ? 'inset 0 0 30px #ef4444' : 'none',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {recyclingAnim && (
                            <div style={{
                                position: 'absolute', width: '100%', height: '100%',
                                background: 'radial-gradient(circle, transparent 20%, #ef4444 100%)',
                                animation: 'pulse-crimson 0.2s infinite'
                            }} />
                        )}
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px', opacity: recyclingAnim ? 0 : 1 }}>
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        {recyclingAnim ? (
                            <span style={{ color: '#fff', fontWeight: '900', fontSize: '14px', textShadow: '0 0 10px #ef4444' }}>DESTROYING...</span>
                        ) : (
                            <span>CLICK TO RECYCLE</span>
                        )}
                    </div>
                </div>

                <button onClick={onClose} style={{
                    background: '#3b82f6',
                    border: 'none',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginTop: '5px',
                    width: '100%',
                    letterSpacing: '2px',
                    transition: 'background 0.2s'
                }}>CLOSE (X)</button>
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

            {
                (hoveredItem || lockedItem) && (
                    <MeteoriteTooltip
                        meteorite={(lockedItem || hoveredItem)!.item}
                        gameState={gameState}
                        meteoriteIdx={moduleSockets.diamonds.indexOf((lockedItem || hoveredItem)!.item)}
                        x={(lockedItem || hoveredItem)!.x}
                        y={(lockedItem || hoveredItem)!.y}
                        isInteractive={true}
                        onRemove={() => {
                            const target = lockedItem || hoveredItem;
                            if (!target) return false;
                            const idx = moduleSockets.diamonds.indexOf(target.item);
                            // Force Remove Logic
                            if (idx !== -1 && !movedItem) {
                                if (spendDust(5)) {
                                    const item = moduleSockets.diamonds[idx];
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
                )
            }
            {
                hoveredHex && (
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
                )
            }

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
        </div >
    );
};
