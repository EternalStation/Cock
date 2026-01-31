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
                    <div className="stats-table" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* LEFT SUB-COLUMN */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                            <div>
                                <h3 style={{ borderBottom: '1px solid #444', paddingBottom: 10, marginBottom: 10, color: '#fff', letterSpacing: 2, fontSize: 16 }}>COMBAT RECORD</h3>
                                <div className="stat-row-death">
                                    <span>Time Survived</span>
                                    <span className="stat-val-death" style={{ color: '#fff' }}>{formatTime(stats.time)}</span>
                                </div>
                                <div className="stat-row-death">
                                    <span>Level Reached</span>
                                    <span className="stat-val-death" style={{ color: '#00FF88' }}>{displayStats.level}</span>
                                </div>
                                <div className="stat-row-death">
                                    <span>Enemies Eliminated</span>
                                    <span className="stat-val-death" style={{ color: '#fff' }}>{displayStats.kills}</span>
                                </div>
                            </div>

                            <div>
                                <h3 style={{ borderBottom: '1px solid #444', paddingBottom: 10, marginBottom: 10, color: '#fff', letterSpacing: 2, fontSize: 16 }}>FINAL ATTRIBUTES</h3>
                                <div className="stat-row-death">
                                    <span>Damage</span>
                                    <span className="stat-val-death" style={{ color: '#fff' }}>{Math.round(calcStat(gameState.player.dmg))}</span>
                                </div>
                                <div className="stat-row-death">
                                    <span>Attack Speed</span>
                                    <span className="stat-val-death" style={{ color: '#fff' }}>{(calcStat(gameState.player.atk) / 200).toFixed(1)}/s</span>
                                </div>
                                <div className="stat-row-death">
                                    <span>XP Gain</span>
                                    <span className="stat-val-death" style={{ color: '#00FF88' }}>
                                        {Math.round(calcStat({
                                            ...gameState.player.xp_per_kill,
                                            base: 40 + (gameState.player.level * 3)
                                        }))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SUB-COLUMN */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ color: '#64748b', fontSize: 10, marginBottom: 5, textTransform: 'uppercase', textAlign: 'center', letterSpacing: 2 }}>System Profile</div>
                                <RadarChart player={gameState.player} size={160} />
                            </div>

                            <div>
                                <h3 style={{ borderBottom: '1px solid #444', paddingBottom: 10, marginBottom: 10, color: '#94a3b8', letterSpacing: 2, fontSize: 13, textTransform: 'uppercase' }}>Performance</h3>
                                <div className="stat-row-death" style={{ fontSize: 14 }}>
                                    <span style={{ color: '#94a3b8' }}>Total Damage Dealt</span>
                                    <span className="stat-val-death" style={{ color: '#f59e0b' }}>{formatDmg(gameState.player.damageDealt)}</span>
                                </div>
                                <div className="stat-row-death" style={{ fontSize: 14 }}>
                                    <span style={{ color: '#94a3b8' }}>Total Damage Taken</span>
                                    <span className="stat-val-death" style={{ color: '#fff' }}>{formatDmg(gameState.player.damageTaken)}</span>
                                </div>
                                <div className="stat-row-death" style={{ fontSize: 14 }}>
                                    <span style={{ color: '#94a3b8' }}>Damage Blocked</span>
                                    <span className="stat-val-death" style={{ color: '#3b82f6' }}>{formatDmg(gameState.player.damageBlocked)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'modules' && (
                    <div className="stats-table" style={{ maxHeight: 600, overflowY: 'auto' }}>
                        <h3 style={{ borderBottom: '1px solid #444', paddingBottom: 15, marginBottom: 25, color: '#fff', letterSpacing: 2, fontSize: 18 }}>INSTALLED MODULES</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            {grouped.map((g, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: 8,
                                    borderLeft: `4px solid ${g.choice.rarity.color}`,
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <span style={{ color: g.choice.rarity.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>
                                            {g.choice.rarity.label}
                                        </span>
                                        <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {g.choice.type.name}
                                        </span>
                                    </div>
                                    <div style={{
                                        background: '#1e293b', color: '#fff', fontSize: 12, fontWeight: 700,
                                        padding: '2px 8px', borderRadius: 4, minWidth: 28, textAlign: 'center', marginLeft: 10
                                    }}>
                                        x{g.count}
                                    </div>
                                </div>
                            ))}
                            {grouped.length === 0 && <div style={{ color: '#666', fontStyle: 'italic', gridColumn: 'span 3' }}>No modules installed.</div>}
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
