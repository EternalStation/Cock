import React, { useState } from 'react';
import type { GameState, Meteorite, MeteoriteRarity } from '../logic/types';

interface ModuleMenuProps {
    gameState: GameState;
    isOpen: boolean;
    onClose: () => void;
    onSocketUpdate: (type: 'hex' | 'diamond', index: number, item: any) => void;
    onInventoryUpdate: (index: number, item: any) => void;
}

const RARITY_COLORS: Record<MeteoriteRarity, string> = {
    scrap: '#9ca3af',
    anomalous: '#14b8a6',
    quantum: '#06b6d4',
    astral: '#a855f7',
    radiant: '#eab308'
};

const RARITY_IMAGES: Record<MeteoriteRarity, string> = {
    scrap: '/assets/meteorites/scrapNoBackgound.png',
    anomalous: '/assets/meteorites/anomalousNoBackgound.png',
    quantum: '/assets/meteorites/quantumNoBackgound.png',
    astral: '/assets/meteorites/astralNoBackgound.png',
    radiant: '/assets/meteorites/radiantNoBackgound.png'
};

export const ModuleMenu: React.FC<ModuleMenuProps> = ({ gameState, isOpen, onClose, onSocketUpdate, onInventoryUpdate }) => {
    const [draggedItem, setDraggedItem] = useState<{ item: Meteorite, source: 'inventory' | 'diamond', index: number } | null>(null);

    if (!isOpen) return null;

    const { moduleSockets, inventory } = gameState;
    const centerX = 540;
    const centerY = 540;
    const innerRadius = 170;
    const outerRadius = 260;
    const edgeRadius = 350;

    // Helper for Hexagon Points
    const getHexPoints = (x: number, y: number, r: number) => {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            points.push(`${x + r * Math.cos(angle)},${y + r * Math.sin(angle)}`);
        }
        return points.join(' ');
    };

    // Outer Hexagons (Legendary Sockets)
    const hexPositions = Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i;
        const pos = { x: centerX + outerRadius * Math.cos(angle), y: centerY + outerRadius * Math.sin(angle) };
        // Vertex data for connections (6 corners)
        const vertices = Array.from({ length: 6 }).map((_, vIdx) => {
            const vAngle = (Math.PI / 3) * vIdx;
            return { x: pos.x + 60 * Math.cos(vAngle), y: pos.y + 60 * Math.sin(vAngle) };
        });
        return { ...pos, vertices };
    });

    // Inner Diamonds (Meteorite Sockets 0-5)
    const innerDiamondPositions = Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        const pos = { x: centerX + innerRadius * Math.cos(angle), y: centerY + innerRadius * Math.sin(angle) };
        // Vertex data (rotated such that vertex[2] points towards center)
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

    // Outer Edge Diamonds (Meteorite Sockets 6-11)
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

    // Central Hexagon Midpoints (for 90 degree perpendicular connections)
    // Vertices are at 0, 60, 120... Midpoints are at 30, 90, 150...
    // Apothem = R * cos(30) = 80 * 0.866 = 69.28
    const centerSideMidpoints = Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        return { x: centerX + 69.28 * Math.cos(angle), y: centerY + 69.28 * Math.sin(angle) };
    });

    const allDiamondPositions = [...innerDiamondPositions, ...edgeDiamondPositions];

    const INACTIVE_STROKE = "rgba(74, 85, 104, 0.2)";

    // Helper for Crater Points (Vertex approximation for circles)
    const getCraterVertices = (x: number, y: number, r: number) => {
        return Array.from({ length: 12 }).map((_, i) => {
            const a = (Math.PI / 6) * i;
            return { x: x + r * Math.cos(a), y: y + r * Math.sin(a) };
        });
    };

    // Helper to find the closest pair of vertices between two sets
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

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'radial-gradient(circle, rgb(10, 10, 30) 0%, rgb(2, 2, 5) 100%)',
            zIndex: 2000, color: 'white', fontFamily: 'Orbitron, sans-serif',
            overflow: 'hidden'
        }}>

            <svg width="100%" height="100%" viewBox="0 0 1920 1080">
                {/* Header for Module Grid */}
                <text x={centerX} y={centerY - 480} textAnchor="middle" fill="#22d3ee" fontSize="32" fontWeight="900" style={{ letterSpacing: '8px', opacity: 0.8 }}>MODULE MATRIX</text>
                <text x={centerX} y={centerY - 440} textAnchor="middle" fill="#94a3b8" fontSize="12" style={{ letterSpacing: '2px', opacity: 0.6 }}>CONSTRUCT SYNERGIES BY SLOTTING METEORITES AND RECOVERED MODULES</text>
                <line x1={centerX - 250} y1={centerY - 425} x2={centerX + 250} y2={centerY - 425} stroke="#22d3ee" strokeWidth="1" opacity="0.2" />
                {/* Central Body */}
                <polygon
                    points={getHexPoints(centerX, centerY, 80)}
                    fill="rgba(34, 211, 238, 0.1)"
                    stroke="#22d3ee"
                    strokeWidth="4"
                    className="glow-cyan"
                />

                {/* INACTIVE LINE STYLE BASE */}
                {/* All inactive lines use the same color and opacity */}

                {/* 1. XS LINES (Hex-Hex, 6 connections) */}
                {hexPositions.map((pos, i) => {
                    const nextPos = hexPositions[(i + 1) % 6];
                    const active = moduleSockets.hexagons[i] && moduleSockets.hexagons[(i + 1) % 6];
                    const { v1, v2 } = findClosestVertices(pos.vertices, nextPos.vertices);

                    return (
                        <g key={`xs-group-${i}`}>
                            <line
                                x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                stroke={active ? "#A855F7" : INACTIVE_STROKE}
                                strokeWidth={active ? "3" : "2"}
                                opacity={active ? 0.3 : 1}
                                className={active ? "pulse-purple" : ""}
                            />
                            {active && (
                                <>
                                    <line
                                        x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                        stroke="#D8B4FE" strokeWidth="5" strokeLinecap="round"
                                        strokeDasharray="2, 120"
                                        className="energy-dot-forward"
                                    />
                                    <line
                                        x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                        stroke="#D8B4FE" strokeWidth="5" strokeLinecap="round"
                                        strokeDasharray="2, 120"
                                        className="energy-dot-reverse"
                                    />
                                </>
                            )}
                        </g>
                    );
                })}

                {/* 2. MS LINES (Met-Met, 15 connections total) */}
                {/* 2.1 Inner-Inner Adjacent (6) */}
                {innerDiamondPositions.map((pos, i) => {
                    const nextPos = innerDiamondPositions[(i + 1) % 6];
                    const active = moduleSockets.diamonds[i] && moduleSockets.diamonds[(i + 1) % 6];
                    const { v1, v2 } = findClosestVertices(getCraterVertices(pos.x, pos.y, 35), getCraterVertices(nextPos.x, nextPos.y, 35));
                    return (
                        <g key={`ms-ii-adj-group-${i}`}>
                            <line
                                x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                stroke={active ? "#EF4444" : INACTIVE_STROKE}
                                strokeWidth={active ? "3" : "2"}
                                opacity={active ? 0.3 : 1}
                                className={active ? "pulse-crimson" : ""}
                            />
                            {active && (
                                <>
                                    <line
                                        x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                        stroke="#F87171" strokeWidth="5" strokeLinecap="round"
                                        strokeDasharray="2, 120"
                                        className="energy-dot-forward"
                                    />
                                    <line
                                        x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                        stroke="#F87171" strokeWidth="5" strokeLinecap="round"
                                        strokeDasharray="2, 120"
                                        className="energy-dot-reverse"
                                    />
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
                    const { v1, v2 } = findClosestVertices(getCraterVertices(pos.x, pos.y, 35), getCraterVertices(oppPos.x, oppPos.y, 35));
                    return (
                        <g key={`ms-ii-opp-group-${i}`}>
                            <line
                                x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                stroke={active ? "#EF4444" : INACTIVE_STROKE}
                                strokeWidth={active ? "3" : "2"}
                                opacity={active ? 0.3 : 1}
                                className={active ? "pulse-crimson" : ""}
                            />
                            {active && (
                                <>
                                    <line
                                        x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                        stroke="#F87171" strokeWidth="5" strokeLinecap="round"
                                        strokeDasharray="2, 120"
                                        className="energy-dot-forward"
                                    />
                                    <line
                                        x1={v1.x} y1={v1.y} x2={v2.x} y2={v2.y}
                                        stroke="#F87171" strokeWidth="5" strokeLinecap="round"
                                        strokeDasharray="2, 120"
                                        className="energy-dot-reverse"
                                    />
                                </>
                            )}
                        </g>
                    );
                })}
                {/* 2.3 Inner-Outer Radial (6) */}
                {edgeDiamondPositions.map((ePos, i) => {
                    const iPos = innerDiamondPositions[i];
                    const active = moduleSockets.diamonds[i + 6] && moduleSockets.diamonds[i];
                    const { v1, v2 } = findClosestVertices(getCraterVertices(ePos.x, ePos.y, 35), getCraterVertices(iPos.x, iPos.y, 35));
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

                {/* 3. XMS LINES (Hex-Met, 30 connections total) */}
                {/* 3.1 Center-Inner Perpendicular (6) */}
                {innerDiamondPositions.map((pos, i) => {
                    const active = moduleSockets.diamonds[i];
                    const mid = centerSideMidpoints[i];
                    const craterV = getCraterVertices(pos.x, pos.y, 35);
                    const { v1: targetV } = findClosestVertices(craterV, [mid]);
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
                {/* 3.2 OuterHex-InnerMet (12) - Each Inner gets 2 from adjacent Hexes */}
                {hexPositions.map((hPos, i) => {
                    const dIdx1 = i;
                    const dIdx2 = (i + 5) % 6;
                    const active1 = moduleSockets.hexagons[i] && moduleSockets.diamonds[dIdx1];
                    const active2 = moduleSockets.hexagons[i] && moduleSockets.diamonds[dIdx2];
                    const dPos1 = innerDiamondPositions[dIdx1];
                    const dPos2 = innerDiamondPositions[dIdx2];
                    const pair1 = findClosestVertices(hPos.vertices, getCraterVertices(dPos1.x, dPos1.y, 35));
                    const pair2 = findClosestVertices(hPos.vertices, getCraterVertices(dPos2.x, dPos2.y, 35));
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
                            <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke={active2 ? "#6366F1" : INACTIVE_STROKE} strokeWidth={active2 ? "2" : "1"} opacity={active2 ? "0.3" : 1} className={active2 ? "synergy-trail" : ""} />
                            {active2 && (
                                <>
                                    <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>
                    ];
                })}
                {/* 3.3 OuterHex-EdgeMet (12) - Each Edge gets 2 from adjacent Hexes */}
                {hexPositions.map((hPos, i) => {
                    const eIdx1 = i;
                    const eIdx2 = (i + 5) % 6;
                    const active1 = moduleSockets.hexagons[i] && moduleSockets.diamonds[eIdx1 + 6];
                    const active2 = moduleSockets.hexagons[i] && moduleSockets.diamonds[eIdx2 + 6];
                    const ePos1 = edgeDiamondPositions[eIdx1];
                    const ePos2 = edgeDiamondPositions[eIdx2];
                    const pair1 = findClosestVertices(hPos.vertices, getCraterVertices(ePos1.x, ePos1.y, 35));
                    const pair2 = findClosestVertices(hPos.vertices, getCraterVertices(ePos2.x, ePos2.y, 35));
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
                            <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke={active2 ? "#6366F1" : INACTIVE_STROKE} strokeWidth={active2 ? "2" : "1"} opacity={active2 ? 0.4 : 1} className={active2 ? "synergy-trail" : ""} />
                            {active2 && (
                                <>
                                    <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-forward" />
                                    <line x1={pair2.v1.x} y1={pair2.v1.y} x2={pair2.v2.x} y2={pair2.v2.y} stroke="#818CF8" strokeWidth="3" strokeLinecap="round" strokeDasharray="2, 120" className="energy-dot-reverse" />
                                </>
                            )}
                        </g>
                    ];
                })}

                {/* SOCKETS DRAWN LAST TO BE IN FRONT */}
                <defs>
                    <radialGradient id="socket-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(2, 6, 23, 0.95)" />
                        <stop offset="70%" stopColor="rgba(15, 23, 42, 0.6)" />
                        <stop offset="100%" stopColor="rgba(30, 41, 59, 0.2)" />
                    </radialGradient>
                    <filter id="rugged-rim">
                        <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="3" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
                    </filter>
                </defs>

                <polygon
                    points={getHexPoints(centerX, centerY, 80)}
                    fill="url(#socket-grad)"
                    stroke="#22d3ee"
                    strokeWidth="4"
                    className="glow-cyan"
                />

                {hexPositions.map((pos, i) => (
                    <g key={`hex-socket-${i}`}>
                        <polygon
                            points={getHexPoints(pos.x, pos.y, 60)}
                            fill="url(#socket-grad)"
                            stroke="rgba(250, 204, 21, 0.5)"
                            strokeWidth="2"
                            className="glow-yellow"
                        />
                    </g>
                ))}

                {allDiamondPositions.map((pos, i) => (
                    <g key={`diamond-socket-${i}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                            if (draggedItem) {
                                const targetIdx = i;
                                const item = draggedItem.item;

                                if (draggedItem.source === 'inventory') {
                                    const existing = moduleSockets.diamonds[targetIdx];
                                    onSocketUpdate('diamond', targetIdx, item);
                                    onInventoryUpdate(draggedItem.index, existing);
                                } else if (draggedItem.source === 'diamond') {
                                    if (draggedItem.index !== targetIdx) {
                                        const existing = moduleSockets.diamonds[targetIdx];
                                        onSocketUpdate('diamond', targetIdx, item);
                                        onSocketUpdate('diamond', draggedItem.index, existing);
                                    }
                                }
                                setDraggedItem(null);
                            }
                        }}
                    >
                        {/* Outer Rim */}
                        <circle
                            cx={pos.x} cy={pos.y} r="40"
                            fill="none"
                            stroke="rgba(236, 72, 153, 0.4)"
                            strokeWidth="2"
                            filter="url(#rugged-rim)"
                            className="glow-pink"
                        />
                        {/* Crater Body */}
                        <circle
                            cx={pos.x} cy={pos.y} r="35"
                            fill="url(#socket-grad)"
                            stroke="rgba(236, 72, 153, 0.25)"
                            strokeWidth="1"
                            filter="url(#rugged-rim)"
                        />
                        {/* Inner pit */}
                        <circle
                            cx={pos.x} cy={pos.y} r="25"
                            fill="rgba(0,0,0,0.3)"
                        />

                        {moduleSockets.diamonds[i] && (
                            <foreignObject x={pos.x - 35} y={pos.y - 35} width="70" height="70" style={{ pointerEvents: 'auto' }}>
                                <div
                                    style={{ width: '100%', height: '100%', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    draggable="true"
                                    onDragStart={(e) => {
                                        const item = moduleSockets.diamonds[i];
                                        if (item) {
                                            setDraggedItem({ item, source: 'diamond', index: i });
                                            e.dataTransfer.setData('text/plain', 'meteorite');
                                        }
                                    }}
                                >
                                    <img
                                        src={RARITY_IMAGES[moduleSockets.diamonds[i]!.rarity]}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                                    />
                                </div>
                            </foreignObject>
                        )}
                    </g>
                ))}
            </svg>

            {/* Right Side Inventory Panel */}
            <div style={{
                position: 'absolute', right: 0, top: 0, height: '100%', width: '560px',
                background: 'rgba(5, 5, 15, 0.98)', borderLeft: '4px solid #3b82f6',
                padding: '50px', display: 'flex', flexDirection: 'column', gap: '20px',
                backdropFilter: 'blur(30px)', boxShadow: '-30px 0 60px rgba(0,0,0,0.9)'
            }}>
                <h2 style={{ color: '#22d3ee', margin: '0 0 10px 0', fontSize: '1.5rem', letterSpacing: '4px', textAlign: 'center' }}>INVENTORY</h2>
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px',
                    flex: 1, alignContent: 'start'
                }}>
                    {inventory.map((item, idx) => (
                        <div key={idx}
                            draggable={!!item}
                            onDragStart={() => item && setDraggedItem({ item, source: 'inventory', index: idx })}
                            onDragEnd={() => setDraggedItem(null)}
                            onDragOver={(ev) => ev.preventDefault()}
                            onDrop={() => {
                                if (draggedItem) {
                                    if (draggedItem.source === 'diamond') {
                                        const existingInInv = inventory[idx];
                                        onInventoryUpdate(idx, draggedItem.item);
                                        onSocketUpdate('diamond', draggedItem.index, existingInInv);
                                    } else {
                                        const fromIdx = draggedItem.index;
                                        const toIdx = idx;
                                        if (fromIdx !== toIdx) {
                                            const item1 = inventory[fromIdx];
                                            const item2 = inventory[toIdx];
                                            onInventoryUpdate(toIdx, item1);
                                            onInventoryUpdate(fromIdx, item2);
                                        }
                                    }
                                    setDraggedItem(null);
                                }
                            }}
                            style={{
                                width: '100%', height: '65px', background: 'rgba(2, 6, 23, 0.5)',
                                border: `2px solid ${item ? RARITY_COLORS[item.rarity] : '#1e293b'}`,
                                borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: item ? 'grab' : 'default', position: 'relative',
                                opacity: draggedItem?.source === 'inventory' && draggedItem?.index === idx ? 0.5 : 1
                            }}>
                            {item && (
                                <img src={RARITY_IMAGES[item.rarity]} style={{ width: '80%', height: '80%', objectFit: 'contain', pointerEvents: 'none' }} />
                            )}
                        </div>
                    ))}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Press <span style={{ color: 'white' }}>M</span> to return</span>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#3b82f6', border: 'none', color: 'white', padding: '5px 15px',
                            borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit'
                        }}
                    >
                        CLOSE
                    </button>
                </div>
            </div>

            {/* Custom Styles */}
            <style>{`
                .glow-cyan { filter: drop-shadow(0 0 10px #22d3ee); }
                .glow-yellow { filter: drop-shadow(0 0 7px rgba(250, 204, 21, 0.7)); }
                .glow-pink { filter: drop-shadow(0 0 15px rgba(236, 72, 153, 0.9)); }
                
                .pulse-purple { animation: pulsePurple 3s infinite ease-in-out; }
                .pulse-crimson { animation: pulseCrimson 3s infinite ease-in-out; }
                .synergy-trail { animation: trailPulse 3s infinite ease-in-out; }
                
                .energy-dot-forward { 
                    animation: moveDotForward 10s infinite linear;
                    filter: drop-shadow(0 0 4px currentColor);
                }
                .energy-dot-reverse { 
                    animation: moveDotReverse 10s infinite linear;
                    filter: drop-shadow(0 0 4px currentColor);
                }

                @keyframes moveDotForward {
                    0% { stroke-dashoffset: 1000; }
                    100% { stroke-dashoffset: 0; }
                }
                @keyframes moveDotReverse {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: 1000; }
                }

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
            `}</style>
        </div>
    );
};
