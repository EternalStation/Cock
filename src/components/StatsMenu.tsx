import React from 'react';
import type { GameState, PlayerStats } from '../logic/types';
import { calcStat } from '../logic/MathUtils';

interface StatsMenuProps {
    gameState: GameState;
}


export const StatRow: React.FC<{ label: string; stat: PlayerStats; isPercent?: boolean; inverse?: boolean; extraInfo?: string }> = ({ label, stat, isPercent, inverse, extraInfo }) => {
    const total = calcStat(stat);
    const displayTotal = isPercent ? `${Math.round(total)}% ` : Math.round(total * 10) / 10;
    const base = Math.round(stat.base * 10) / 10;
    const flat = Math.round(stat.flat * 10) / 10;
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
                    ({base} + {flat}) x {100 + mult}%
                </span>
                <span style={{ color: totalColor, fontSize: 12, fontWeight: 900, minWidth: 40, textAlign: 'right' }}>
                    {displayTotal}
                </span>
            </div>
        </div>
    );
};

export const RadarChart: React.FC<{ player: any }> = ({ player }) => {
    // Normalize Stats to 0-100 range for the chart
    // Center is 0, Outer edge is 100
    // 5 Axes: DMG, SPD, HP, REG, ARM

    // Limits for normalization
    const getVal = (curr: number, max: number) => Math.min(100, Math.max(10, (curr / max) * 100));

    // DMG: Base is 50, Max expected ~200
    const dmg = getVal(calcStat(player.dmg), 200);

    // SPD: Base ~500ms, "Max" speed is 50ms (so lower is higher value effectively)
    // We invert it: 500ms = 0 pts, 50ms = 100 pts
    const atkRaw = calcStat(player.atk);
    const atk = Math.min(100, Math.max(10, ((550 - atkRaw) / 500) * 100));

    // HP: Base 150, Max ~1000
    const hp = getVal(calcStat(player.hp), 1000);

    // REG: Base 0.1, Max ~20
    const reg = getVal(calcStat(player.reg), 20);

    // ARM: Base 0, Max ~100
    const arm = getVal(calcStat(player.arm), 100);

    const pts = [
        { label: 'DMG', val: dmg, a: -90 }, // Top
        { label: 'SPD', val: atk, a: -18 }, // Top Right
        { label: 'HP', val: hp, a: 54 },    // Bottom Right
        { label: 'REG', val: reg, a: 126 }, // Bottom Left
        { label: 'ARM', val: arm, a: 198 }  // Top Left
    ];

    const radius = 50;
    const center = 75;

    const points = pts.map(p => {
        const r = (p.val / 100) * radius;
        const rad = p.a * (Math.PI / 180);
        return `${center + r * Math.cos(rad)},${center + r * Math.sin(rad)} `;
    }).join(' ');

    const bgPoints = pts.map(p => {
        const rad = p.a * (Math.PI / 180);
        return `${center + radius * Math.cos(rad)},${center + radius * Math.sin(rad)} `;
    }).join(' ');

    return (
        <div style={{ position: 'relative', width: 150, height: 150, margin: '0 auto' }}>
            <svg width="150" height="150" viewBox="0 0 150 150">
                {/* Background Pentagon */}
                <polygon points={bgPoints} fill="rgba(30, 41, 59, 0.5)" stroke="#334155" strokeWidth="1" />
                {/* Inner Webs */}
                <polygon points={pts.map(p => {
                    const r = 0.5 * radius;
                    const rad = p.a * (Math.PI / 180);
                    return `${center + r * Math.cos(rad)},${center + r * Math.sin(rad)} `
                }).join(' ')} fill="none" stroke="#334155" strokeWidth="0.5" />

                {/* Data Polygon */}
                <polygon points={points} fill="rgba(34, 211, 238, 0.3)" stroke="#22d3ee" strokeWidth="2" />

                {/* Dots */}
                {pts.map((p, i) => {
                    const r = (p.val / 100) * radius;
                    const rad = p.a * (Math.PI / 180);
                    const x = center + r * Math.cos(rad);
                    const y = center + r * Math.sin(rad);
                    return <circle key={i} cx={x} cy={y} r="2" fill="#fff" />
                })}

                {/* Labels */}
                {pts.map((p, i) => {
                    const r = radius + 12;
                    const rad = p.a * (Math.PI / 180);
                    const x = center + r * Math.cos(rad);
                    const y = center + r * Math.sin(rad);
                    return (
                        <text key={i} x={x} y={y} fill="#94a3b8" fontSize="9" textAnchor="middle" dominantBaseline="middle">
                            {p.label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}

export const StatsMenu: React.FC<StatsMenuProps> = ({ gameState }) => {
    const { player } = gameState;

    return (
        <div className="modal-overlay" style={{ background: 'rgba(2, 6, 23, 0.95)', pointerEvents: 'auto' }}>
            <h2 style={{ color: '#22d3ee', margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: 2 }}>System Diagnostics</h2>

            <div style={{ display: 'flex', gap: 20 }}>
                {/* Left: Table */}
                <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <StatRow label="Health" stat={player.hp} />
                    <StatRow label="Damage" stat={player.dmg} />
                    <StatRow
                        label="Attack Speed"
                        stat={player.atk}
                        extraInfo={`${(Math.min(9999, calcStat(player.atk)) / 200).toFixed(1)} shots/s (Cap 9999)`}
                    />
                    <StatRow label="Regeneration" stat={player.reg} />
                    <StatRow label="Armor" stat={player.arm} extraInfo={`(${(0.95 * (calcStat(player.arm) / (calcStat(player.arm) + 5263)) * 100).toFixed(1)}% Reduction, 95% Max)`} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', marginTop: 10 }}>
                        <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Projectiles</span>
                        <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>{player.multi} (Pierce: {player.pierce})</span>
                    </div>
                </div>

                {/* Right: Radar */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 200 }}>
                    <div style={{ color: '#64748b', fontSize: 10, marginBottom: 10, textTransform: 'uppercase' }}>Build Profile</div>
                    <RadarChart player={player} />
                </div>
            </div>

            <div style={{ marginTop: 20, color: '#475569', fontSize: 10 }}>
                PRESS [C] TO RESUME
            </div>
        </div>
    );
};
