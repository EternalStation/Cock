import React, { useEffect, useState } from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';

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
    }, [stats]);

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
        // Sort by Rarity Weight (assuming weight correlates to tiers: Junk 0.1 ... Divine 0.1)
        // Wait, weight is spawn chance, not tier. I should check ID or Index.
        // Assuming RARITIES array order in constants.ts is the tier order.
        // I don't have access to RARITIES index here easily unless I hardcode map.
        // Junk=0, Divine=9.
        const tierMap: Record<string, number> = {
            'junk': 0, 'broken': 1, 'common': 2, 'uncommon': 3, 'rare': 4,
            'epic': 5, 'legendary': 6, 'mythical': 7, 'ancient': 8, 'divine': 9, 'boss': 10
        };
        const tierA = tierMap[a.rarity.id] || 0;
        const tierB = tierMap[b.rarity.id] || 0;
        return tierA - tierB; // Low to High (Junk First) -> User said "first junk lst divine"
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
        <div className="death-screen" style={{ overflowY: 'auto', maxHeight: '100vh', padding: '40px 0' }}>
            <div className="death-title" style={{ fontSize: 48, marginBottom: 10 }}>TERMINATED</div>
            <div style={{ color: '#ef4444', fontSize: 16, marginBottom: 40, letterSpacing: 2 }}>SYSTEM FAILURE</div>

            <div style={{ display: 'flex', gap: 60, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 1000 }}>

                {/* LEFT COLUMN: STATS */}
                <div className="stats-table" style={{ width: 400, background: 'rgba(0,0,0,0.8)', padding: 30, borderRadius: 12, border: '1px solid #333' }}>
                    <h3 style={{ borderBottom: '1px solid #444', paddingBottom: 10, marginBottom: 20, color: '#fff', letterSpacing: 1 }}>COMBAT RECORD</h3>

                    <div className="stat-row-death">
                        <span>Time Survived</span>
                        <span className="stat-val-death" style={{ color: '#fff' }}>{formatTime(stats.time)}</span>
                    </div>
                    <div className="stat-row-death">
                        <span>Level</span>
                        <span className="stat-val-death" style={{ color: '#00FF88' }}>{displayStats.level}</span>
                    </div>
                    <div className="stat-row-death">
                        <span>Enemies Eliminated</span>
                        <span className="stat-val-death" style={{ color: '#ef4444' }}>{displayStats.kills}</span>
                    </div>

                    <div style={{ height: 1, background: '#444', margin: '15px 0' }} />

                    <div className="stat-row-death">
                        <span>Total Damage Dealt</span>
                        <span className="stat-val-death" style={{ color: '#f59e0b' }}>{formatDmg(gameState.player.damageDealt)}</span>
                    </div>
                    <div className="stat-row-death">
                        <span>Total Damage Received</span>
                        <span className="stat-val-death" style={{ color: '#ef4444' }}>{formatDmg(gameState.player.damageTaken)}</span>
                    </div>
                    <div className="stat-row-death">
                        <span>Damage Blocked/Avoided</span>
                        <span className="stat-val-death" style={{ color: '#3b82f6' }}>{formatDmg(gameState.player.damageBlocked)}</span>
                    </div>
                </div>

                {/* RIGHT COLUMN: UPGRADES */}
                <div style={{ width: 450, background: 'rgba(0,0,0,0.8)', padding: 30, borderRadius: 12, border: '1px solid #333', maxHeight: 500, overflowY: 'auto' }}>
                    <h3 style={{ borderBottom: '1px solid #444', paddingBottom: 10, marginBottom: 20, color: '#fff', letterSpacing: 1 }}>INSTALLED MODULES</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                        {grouped.map((g, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 6,
                                borderLeft: `4px solid ${g.choice.rarity.color}`
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: g.choice.rarity.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                                        {g.choice.rarity.label}
                                    </span>
                                    <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                                        {g.choice.type.name}
                                    </span>
                                </div>
                                <div style={{
                                    background: '#1e293b', color: '#fff', fontSize: 12, fontWeight: 700,
                                    padding: '2px 8px', borderRadius: 4, minWidth: 24, textAlign: 'center'
                                }}>
                                    x{g.count}
                                </div>
                            </div>
                        ))}
                        {grouped.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No modules installed.</div>}
                    </div>
                </div>

            </div>

            <div style={{ display: 'flex', gap: 20, marginTop: 40 }}>
                <button className="btn-restart" onClick={onRestart} style={{ width: 200 }}>RESTART</button>
                <button className="btn-restart" onClick={onQuit} style={{ width: 200, background: 'transparent', border: '1px solid #666', color: '#888' }}>Main Menu</button>
            </div>
        </div>
    );
};
