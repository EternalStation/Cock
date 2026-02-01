import React, { useEffect, useState } from 'react';
import { RadarChart } from './RadarChart';
import type { GameState, UpgradeChoice } from '../logic/types';
import { calcStat } from '../logic/MathUtils';

interface DeathScreenProps {
    stats: {
        time: number;
        kills: number;
        bosses: number;
        level: number;
    };
    gameState: GameState; // Pass full state for detailed stats
    onRestart: () => void;
    onQuit: () => void; // Added onQuit prop
}

export const DeathScreen: React.FC<DeathScreenProps> = ({ stats, gameState, onRestart, onQuit }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'modules'>('overview');

    // Keyboard Navigation
    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            const code = e.code.toLowerCase();
            if (key === 'a' || code === 'keya' || key === 'arrowleft' || code === 'arrowleft') {
                setActiveTab('overview');
            }
            if (key === 'd' || code === 'keyd' || key === 'arrowright' || code === 'arrowright') {
                setActiveTab('modules');
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, []);
    const [displayStats, setDisplayStats] = useState({
        kills: 0,
        level: 0,
    });

    // Count up animation
    useEffect(() => {
        const duration = 1500;
        const startTime = Date.now();

        const animate = () => {
            const now = Date.now();
            const progress = Math.min(1, (now - startTime) / duration);
            // Ease out quart
            const ease = 1 - Math.pow(1 - progress, 4);

            setDisplayStats({
                kills: Math.floor(stats.kills * ease),
                level: Math.floor(stats.level * ease),
            });

            if (progress < 1) requestAnimationFrame(animate);
        };

        animate();
    }, []); // Fixed: Run once on mount to avoid reset loop

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatDmg = (val: number) => {
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
        return Math.floor(val).toString();
    };

    // Sort Upgrades: Rarity (asc weight)
    const upgrades = [...gameState.player.upgradesCollected].sort((a, b) => {
        const tierMap: Record<string, number> = {
            'scrap': 0, 'anomalous': 1, 'quantum': 2, 'astral': 3, 'radiant': 4,
            'abyss': 5, 'eternal': 6, 'divine': 7, 'singularity': 8, 'boss': 9
        };
        const tierA = tierMap[a.rarity.id] || 0;
        const tierB = tierMap[b.rarity.id] || 0;
        // Sort by Tier (Low to High), then by Name
        if (tierA !== tierB) return tierA - tierB;
        return a.type.name.localeCompare(b.type.name);
    });

    // Group Upgrades: Name + Rarity
    const grouped: { choice: UpgradeChoice, count: number }[] = [];
    upgrades.forEach(u => {
        const key = `${u.rarity.id}-${u.type.id}`;
        const existing = grouped.find(g => `${g.choice.rarity.id}-${g.choice.type.id}` === key);
        if (existing) existing.count++;
        else grouped.push({ choice: u, count: 1 });
    });

    return (
        <div className="death-screen" style={{ overflowY: 'auto', padding: '25px 20px', justifyContent: 'flex-start' }}>
            <div className="death-title" style={{ fontSize: 56, marginBottom: 20, marginTop: 10 }}>TERMINATED</div>

            <div className="death-tabs">
                <button
                    className={`death-tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`death-tab ${activeTab === 'modules' ? 'active' : ''}`}
                    onClick={() => setActiveTab('modules')}
                >
                    Installed Modules ({gameState.player.upgradesCollected.length})
                </button>
            </div>

            <div style={{ width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {activeTab === 'overview' && (
                    <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 10 }}>
                        {/* LEFT: PRIMARY STATS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ background: '#0f172a', padding: 25, borderRadius: 8, border: '1px solid #334155' }}>
                                <div style={{ fontSize: 14, color: '#94a3b8', letterSpacing: 2, marginBottom: 20, borderBottom: '1px solid #334155', paddingBottom: 10, fontWeight: 700 }}>
                                    COMBAT RECORD
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#cbd5e1', fontSize: 16 }}>Time Survived</span>
                                        <span style={{ color: '#fff', fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }}>{formatTime(stats.time)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#cbd5e1', fontSize: 16 }}>Level Reached</span>
                                        <span style={{ color: '#22d3ee', fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }}>{displayStats.level}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#cbd5e1', fontSize: 16 }}>Enemies Eliminated</span>
                                        <span style={{ color: '#ef4444', fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }}>{displayStats.kills}</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: '#0f172a', padding: 25, borderRadius: 8, border: '1px solid #334155' }}>
                                <div style={{ fontSize: 14, color: '#94a3b8', letterSpacing: 2, marginBottom: 20, borderBottom: '1px solid #334155', paddingBottom: 10, fontWeight: 700 }}>
                                    PERFORMANCE
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                        <span style={{ color: '#94a3b8' }}>Damage Dealt</span>
                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{formatDmg(gameState.player.damageDealt)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                        <span style={{ color: '#94a3b8' }}>Damage Taken</span>
                                        <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatDmg(gameState.player.damageTaken)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                        <span style={{ color: '#94a3b8' }}>Damage Blocked</span>
                                        <span style={{ color: '#3b82f6', fontWeight: 600 }}>{formatDmg(gameState.player.damageBlocked)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: ATTRIBUTES & BUILD */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ background: '#0f172a', padding: 20, borderRadius: 8, border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ fontSize: 12, color: '#64748b', letterSpacing: 2, marginBottom: 10, fontWeight: 700 }}>SYSTEM BUILD</div>
                                <RadarChart player={gameState.player} size={180} />
                            </div>

                            <div style={{ background: '#0f172a', padding: 25, borderRadius: 8, border: '1px solid #334155' }}>
                                <div style={{ fontSize: 14, color: '#94a3b8', letterSpacing: 2, marginBottom: 20, borderBottom: '1px solid #334155', paddingBottom: 10, fontWeight: 700 }}>
                                    FINAL ATTRIBUTES
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                                    <div>
                                        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>DAMAGE</div>
                                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{Math.round(calcStat(gameState.player.dmg))}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>ATK SPEED</div>
                                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{(calcStat(gameState.player.atk) / 200).toFixed(1)}/s</div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>XP GAIN</div>
                                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
                                            {Math.round(calcStat({
                                                ...gameState.player.xp_per_kill,
                                                base: 40 + (gameState.player.level * 3)
                                            }))}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>MAX HP</div>
                                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
                                            {Math.round(calcStat(gameState.player.hp))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'modules' && (
                    <div style={{ width: '100%', background: '#0f172a', borderRadius: 8, border: '1px solid #334155', padding: 20, maxHeight: 600, overflowY: 'auto' }}>
                        <div style={{ fontSize: 14, color: '#94a3b8', letterSpacing: 2, marginBottom: 20, borderBottom: '1px solid #334155', paddingBottom: 10, fontWeight: 700 }}>
                            INSTALLED MODULES ({gameState.player.upgradesCollected.length})
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15 }}>
                            {grouped.map((g, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: 'rgba(30, 41, 59, 0.5)', padding: '12px 16px', borderRadius: 6,
                                    borderLeft: `3px solid ${g.choice.rarity.color}`,
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <span style={{ color: g.choice.rarity.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 }}>
                                            {g.choice.rarity.label}
                                        </span>
                                        <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {g.choice.type.name}
                                        </span>
                                    </div>
                                    <div style={{
                                        background: 'rgba(0,0,0,0.3)', color: '#94a3b8', fontSize: 12, fontWeight: 700,
                                        padding: '4px 8px', borderRadius: 4, minWidth: 30, textAlign: 'center', marginLeft: 10
                                    }}>
                                        x{g.count}
                                    </div>
                                </div>
                            ))}
                            {grouped.length === 0 && <div style={{ color: '#64748b', fontStyle: 'italic', gridColumn: 'span 3', textAlign: 'center', padding: 20 }}>No modules installed.</div>}
                        </div>
                    </div>
                )}

            </div>

            <div style={{ display: 'flex', gap: 24, marginTop: 24, marginBottom: 24 }}>
                <button className="btn-restart" onClick={onRestart} style={{ minWidth: 200, padding: '12px 24px', fontSize: 23 }}>RESTART</button>
                <button className="btn-restart" onClick={onQuit} style={{ minWidth: 200, padding: '12px 24px', fontSize: 23, background: 'transparent', border: '1px solid #666', color: '#aaa', boxShadow: 'none' }}>MAIN MENU</button>
            </div>
        </div>
    );
};
