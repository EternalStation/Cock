import React, { useState, useEffect, useRef } from 'react';
import { RadarChart } from './RadarChart';
export { RadarChart };
import type { GameState, PlayerStats } from '../logic/types';
import { calcStat } from '../logic/MathUtils';


interface StatsMenuProps {
    gameState: GameState;
}

export const StatRow: React.FC<{ label: string; stat: PlayerStats; isPercent?: boolean; inverse?: boolean; extraInfo?: string }> = ({ label, stat, isPercent, inverse, extraInfo }) => {
    const total = calcStat(stat);
    const displayTotal = isPercent ? `${Math.round(total)}% ` : Math.round(total * 10) / 10;
    const baseFlatSum = Math.round((stat.base + stat.flat) * 10) / 10;
    const mult = Math.round(stat.mult);

    // Color logic
    const totalColor = inverse
        ? (total < stat.base ? '#4ade80' : '#ef4444') // Lower is better (cooldown)
        : (total > stat.base ? '#4ade80' : '#ef4444'); // Higher is better

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #1e293b' }}>
            <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>{label}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {extraInfo && <span style={{ color: '#64748b', fontSize: 10 }}>{extraInfo}</span>}
                <span style={{ color: '#64748b', fontSize: 10 }}>
                    {baseFlatSum} x {100 + mult}%
                </span>
                <span style={{ color: totalColor, fontSize: 12, fontWeight: 900, minWidth: 40, textAlign: 'right' }}>
                    {displayTotal}
                </span>
            </div>
        </div>
    );
};

// --- BLUEPRINT VISUAL PREVIEW ---

const EnemyPreview: React.FC<{ shape: string; color: string }> = ({ shape, color }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.lineWidth = 2;

        const cx = w / 2;
        const cy = h / 2;
        const size = 25;

        // Draw Shape Logic (Simplified from Game Renderer)
        ctx.beginPath();
        if (shape === 'circle') {
            ctx.arc(cx, cy, size, 0, Math.PI * 2);
        } else if (shape === 'triangle') {
            ctx.moveTo(cx, cy - size);
            ctx.lineTo(cx + size * 0.866, cy + size * 0.5);
            ctx.lineTo(cx - size * 0.866, cy + size * 0.5);
            ctx.closePath();
        } else if (shape === 'square') {
            ctx.rect(cx - size, cy - size, size * 2, size * 2);
        } else if (shape === 'diamond') {
            ctx.moveTo(cx, cy - size * 1.3);
            ctx.lineTo(cx + size, cy);
            ctx.lineTo(cx, cy + size * 1.3);
            ctx.lineTo(cx - size, cy);
            ctx.closePath();
        } else if (shape === 'pentagon') {
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
                ctx.lineTo(cx + Math.cos(angle) * size, cy + Math.sin(angle) * size);
            }
            ctx.closePath();
        } else if (shape === 'minion') {
            // Chevron / Dart (Stealth Bomber)
            const p1 = { x: cx + size, y: cy };
            const p2 = { x: cx - size, y: cy + size * 0.7 };
            const p3 = { x: cx - size * 0.3, y: cy };
            const p4 = { x: cx - size, y: cy - size * 0.7 };

            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
        }

        // Fill & Stroke
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.stroke();

    }, [shape, color]);

    return <canvas ref={canvasRef} width={80} height={80} style={{ borderRadius: 8, background: '#0f172a', border: '1px solid #334155' }} />;
};


// --- MAIN MENU ---

export const StatsMenu: React.FC<StatsMenuProps> = ({ gameState }) => {
    const { player } = gameState;
    const [tab, setTab] = useState<'stats' | 'blueprint'>('stats');

    // Enemy Intel Data
    const enemyIntel = [
        {
            id: 'circle',
            name: 'DRONE EX-01',
            role: 'Chaser',
            desc: 'Standard relentless pursuit unit. Swarms in large numbers.',
            stats: 'HP: Normal | Spd: Fast',
            color: '#00FF00'
        },
        {
            id: 'triangle',
            name: 'VECTOR STRIKER',
            role: 'Charger',
            desc: 'Charges at high speed after locking onto position. Dangerous in groups.',
            stats: 'HP: Low | Spd: Very Fast',
            color: '#00FFFF'
        },
        {
            id: 'square',
            name: 'BLOCKADE HULL',
            role: 'Tank',
            desc: 'High durability unit acting as a moving wall. Slow but tough.',
            stats: 'HP: High | Spd: Slow',
            color: '#BF00FF'
        },
        {
            id: 'diamond',
            name: 'PRISM SNIPER',
            role: 'Ranger',
            desc: 'Kiting AI (Variable Range 500-900px). Randomized Dodge (3-5s). Slow Fire (6s). Projectiles (Base 20 Dmg, +50% per 5m).',
            stats: 'HP: Low | Spd: Fast',
            color: '#FF9900'
        },
        {
            id: 'pentagon',
            name: 'HIVE OVERLORD',
            role: 'Summoner',
            desc: 'Maintains 500-700px command distance. Enters stationary casting state to spawn. (5s Cast Time).',
            stats: 'HP: Very High | Spd: Medium',
            color: '#FF0000'
        },
        {
            id: 'minion', // Special
            name: 'SWARM MINION',
            role: 'Minion',
            desc: 'Spawned by Hive Overlords. Spirals towards target. Weak but numerous.',
            stats: 'HP: Very Low | Spd: Very Fast',
            color: '#FFD700',
            shape: 'minion'
        }
    ];

    return (
        <div className="stats-panel-slide open">
            {/* TABS */}
            <div style={{ display: 'flex', borderBottom: '1px solid #334155', marginBottom: 20 }}>
                <div
                    onClick={() => setTab('stats')}
                    style={{
                        flex: 1, padding: 10, textAlign: 'center', cursor: 'pointer',
                        color: tab === 'stats' ? '#22d3ee' : '#64748b',
                        fontWeight: 900,
                        borderBottom: tab === 'stats' ? '2px solid #22d3ee' : 'none'
                    }}
                >
                    SYSTEM STATS
                </div>
                <div
                    onClick={() => setTab('blueprint')}
                    style={{
                        flex: 1, padding: 10, textAlign: 'center', cursor: 'pointer',
                        color: tab === 'blueprint' ? '#22d3ee' : '#64748b',
                        fontWeight: 900,
                        borderBottom: tab === 'blueprint' ? '2px solid #22d3ee' : 'none'
                    }}
                >
                    BLUEPRINTS
                </div>
            </div>

            {/* CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>

                {tab === 'stats' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                        {/* Radar Chart */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: 10, marginBottom: 10, textTransform: 'uppercase' }}>Build Profile</div>
                            <RadarChart player={player} size={180} />
                        </div>

                        {/* Left: Table */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <StatRow label="Health" stat={player.hp} />
                            <StatRow label="Damage" stat={player.dmg} />
                            <StatRow
                                label="Attack Speed"
                                stat={player.atk}
                                extraInfo={`${(Math.min(9999, calcStat(player.atk)) / 200).toFixed(1)}/s`}
                            />
                            <StatRow label="Regeneration" stat={player.reg} />
                            <StatRow label="Armor" stat={player.arm} extraInfo={`(${(0.95 * (calcStat(player.arm) / (calcStat(player.arm) + 5263)) * 100).toFixed(1)}%)`} />
                            {/* XP Display: Explicit Breakdown */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #1e293b' }}>
                                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>XP Gain</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ color: '#64748b', fontSize: 10 }}>
                                        ({40 + (player.level * 3)} + {player.xp_per_kill.flat}) x {100 + player.xp_per_kill.mult}%
                                    </span>
                                    <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 900, minWidth: 40, textAlign: 'right' }}>
                                        {Math.round((40 + (player.level * 3) + player.xp_per_kill.flat) * (1 + player.xp_per_kill.mult / 100))}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #333', marginTop: 10 }}>
                                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>PROJECTILES</span>
                                <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>{player.multi} <span style={{ color: '#666' }}>(Pierce: {player.pierce})</span></span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>LEVEL</span>
                                <span style={{ color: '#00FF88', fontSize: 14, fontWeight: 900 }}>{player.level}</span>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'blueprint' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                        {enemyIntel.map(intel => (
                            <div key={intel.id} style={{
                                display: 'flex', gap: 15, alignItems: 'center',
                                background: '#1e293b50', padding: 10, borderRadius: 8,
                                border: `1px solid ${intel.color}40`
                            }}>
                                <EnemyPreview shape={intel.shape || intel.id} color={intel.color} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ color: intel.color, fontWeight: 900, fontSize: 14 }}>{intel.name}</div>
                                        <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', background: '#0f172a', padding: '2px 6px', borderRadius: 4 }}>
                                            {intel.role}
                                        </div>
                                    </div>
                                    <div style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4, lineHeight: 1.3 }}>
                                        {intel.desc}
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 4, fontWeight: 700 }}>
                                        {intel.stats}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>

            <div style={{ marginTop: 'auto', paddingTop: 20, color: '#475569', fontSize: 10, textAlign: 'center' }}>
                PRESS [C] TO CLOSE
            </div>
        </div>
    );
};
