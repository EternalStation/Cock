import React, { useEffect, useState } from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';
import { calcStat } from '../logic/MathUtils';
import { CANVAS_WIDTH } from '../logic/constants';
import { playUpgradeSfx } from '../logic/AudioLogic';
import { StatRow, RadarChart } from './StatsMenu';
import { UpgradeCard } from './UpgradeCard';

interface HUDProps {
    gameState: GameState;
    upgradeChoices: UpgradeChoice[] | null;
    onUpgradeSelect: (c: UpgradeChoice) => void;
    gameOver: boolean;
    onRestart: () => void;
    bossWarning: number | null;
}

export const HUD: React.FC<HUDProps> = ({ gameState, upgradeChoices, onUpgradeSelect, gameOver, onRestart, bossWarning }) => {
    const { player, score, gameTime } = gameState;
    const { xp } = player;
    const maxHp = calcStat(player.hp);

    // Upgrade Nav
    const [selectedIndex, setSelectedIndex] = useState(0);

    // HP Bar Animation Control
    const [prevHp, setPrevHp] = useState(player.curHp);
    const currentHpPercent = (player.curHp / maxHp) * 100;
    const prevHpPercent = (prevHp / maxHp) * 100;
    const isHealing = currentHpPercent > prevHpPercent;

    useEffect(() => {
        setPrevHp(player.curHp);
    }, [player.curHp]);

    useEffect(() => {
        if (!upgradeChoices) return;
        setSelectedIndex(0);

        const handleKeys = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const key = e.key.toLowerCase();
            if (key === 'a' || key === 'arrowleft') {
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : upgradeChoices.length - 1));
            }
            if (key === 'd' || key === 'arrowright') {
                setSelectedIndex(prev => (prev < upgradeChoices.length - 1 ? prev + 1 : 0));
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [upgradeChoices]);

    // Separate effect for selection confirming to always have fresh index
    useEffect(() => {
        if (!upgradeChoices) return;
        const handleSelect = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const key = e.key.toLowerCase();
            if (key === ' ' || key === 'enter') {
                const choice = upgradeChoices[selectedIndex];
                playUpgradeSfx(choice.rarity?.id || 'common');
                onUpgradeSelect(choice);
            }
        };
        window.addEventListener('keydown', handleSelect);
        return () => window.removeEventListener('keydown', handleSelect);
    }, [upgradeChoices, selectedIndex, onUpgradeSelect]);



    return (
        <>
            {/* Top UI */}
            <div style={{ position: 'absolute', top: 15, left: 15, pointerEvents: 'none', zIndex: 10 }}>
                <div className="kills" style={{ color: '#22d3ee', textShadow: '0 0 10px rgba(34, 211, 238, 0.5)', fontSize: 24, fontWeight: 800 }}>
                    {score.toString().padStart(4, '0')}
                </div>
                <div className="stat-row" style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: 1 }}>
                    LVL {player.level}
                </div>
                <div className="stat-row" style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: 1 }}>
                    {Math.floor(gameTime / 60)}:{Math.floor(gameTime % 60).toString().padStart(2, '0')}
                </div>
            </div>

            {/* Boss Warning */}
            {bossWarning !== null && (
                <div id="boss-warning" className="glitch-text" style={{
                    position: 'absolute', top: 15, right: 15, textAlign: 'right',
                    color: '#ef4444', fontWeight: 900, letterSpacing: 1, fontSize: 12
                }}>
                    ANOMALY DETECTED: {Math.ceil(bossWarning)}s
                </div>
            )}

            {/* XP Bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 6, background: '#000' }}>
                <div style={{
                    width: `${(xp.current / xp.needed) * 100}%`,
                    height: '100%',
                    background: '#4ade80',
                    boxShadow: '0 0 15px #4ade80',
                    transition: 'width 0.2s'
                }} />
            </div>

            {/* HP Bar */}
            <div style={{
                position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                width: Math.min(CANVAS_WIDTH * 0.8, 250), height: 16, background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #334155', borderRadius: 20, overflow: 'hidden'
            }}>
                <div style={{
                    width: `${(player.curHp / maxHp) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #ef4444, #f87171)',
                    transition: isHealing ? 'width 0.3s' : 'width 0s' // Instant drop on damage, slow growth on regen
                }} />
                <div style={{
                    position: 'absolute', width: '100%', textAlign: 'center', top: 0,
                    fontSize: 9, fontWeight: 900, lineHeight: '16px', color: '#fff'
                }}>
                    {Math.ceil(player.curHp)} / {Math.ceil(maxHp)}
                </div>
            </div>

            {upgradeChoices && (
                <div className="upgrade-menu-overlay">
                    {/* Background Layers */}
                    <div className="fog-layer" />
                    <div className="fog-pulse" />
                    <div className="honeycomb-layer">
                        <div className="honeycomb-cluster" style={{ top: '10%', left: '10%' }} />
                        <div className="honeycomb-cluster" style={{ bottom: '20%', right: '15%' }} />
                    </div>


                    {/* Cards Container */}
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 20, perspective: '1000px', gap: '60px' }}>
                        {upgradeChoices.map((c, i) => (
                            <div key={i} className="upgrade-card-container">
                                <UpgradeCard
                                    choice={c}
                                    index={i}
                                    isSelected={i === selectedIndex}
                                    onSelect={(choice) => {
                                        playUpgradeSfx(choice.rarity?.id || 'common');
                                        onUpgradeSelect(choice);
                                    }}
                                    onHover={setSelectedIndex}
                                    isSelecting={false}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Title (Moved to Bottom) */}
                    <h2 style={{
                        marginTop: 40,
                        color: '#FFFFFF',
                        fontSize: 24,
                        fontFamily: 'Orbitron, sans-serif',
                        textTransform: 'uppercase',
                        letterSpacing: 4,
                        textShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
                        zIndex: 20,
                        textAlign: 'center',
                        width: '100%',
                        marginBottom: 5
                    }}>
                        {upgradeChoices[0].isSpecial ? "VOID TECHNOLOGY DETECTED" : "SELECT AUGMENTATION"}
                    </h2>

                    {/* Rarity Boost Notification */}
                    {gameState.rareRewardActive && (
                        <div className="glitch-text" style={{
                            color: '#FACC15',
                            fontSize: 12,
                            fontFamily: 'Orbitron, sans-serif',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                            textShadow: '0 0 10px #FACC15',
                            zIndex: 20,
                            textAlign: 'center',
                            width: '100%',
                            marginBottom: 20,
                            animation: 'pulse 1s infinite'
                        }}>
                            ANOMALY TERMINATED: RARITY CHANCE INCREASED
                        </div>
                    )}
                </div>
            )}

            {/* Game Over Modal */}
            {gameOver && (
                <div className="modal-overlay">
                    <h1 style={{ color: '#ef4444', margin: '0 0 10px 0', fontSize: 24, textAlign: 'center', letterSpacing: 4, textShadow: '0 0 20px #ef4444' }}>
                        SIMULATION TERMINATED
                    </h1>

                    <div style={{ display: 'flex', gap: 20, width: '100%', maxWidth: 700, alignItems: 'flex-start' }}>

                        {/* LEFT: Stats & Chart */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 15 }}>
                            {/* Run Stats */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                                background: 'rgba(15, 23, 42, 0.6)', padding: 15, borderRadius: 12, border: '1px solid #334155',
                            }}>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>TIME</div>
                                <div style={{ textAlign: 'right', fontWeight: 900, fontSize: 14 }}>
                                    {Math.floor(gameTime / 60)}m {Math.floor(gameTime % 60)}s
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>KILLS</div>
                                <div style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#22d3ee' }}>
                                    {score}
                                </div>
                            </div>

                            {/* Radar Chart */}
                            <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: 12, padding: 10, border: '1px solid #334155' }}>
                                <RadarChart player={player} />
                            </div>

                            {/* Combat Stats */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                                background: 'rgba(15, 23, 42, 0.6)', padding: 15, borderRadius: 12, border: '1px solid #334155',
                            }}>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>DMG DEALT</div>
                                <div style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#facc15' }}>
                                    {(player.damageDealt / 1000).toFixed(1)}k
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: 12 }}>TAKEN / BLK</div>
                                <div style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#f87171' }}>
                                    {Math.round(player.damageTaken)} / <span style={{ color: '#4ade80' }}>{Math.round(player.damageBlocked)}</span>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Detailed Stats & Upgrades */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 15 }}>
                            <div style={{
                                background: 'rgba(15, 23, 42, 0.6)', padding: 15, borderRadius: 12, border: '1px solid #334155',
                                display: 'flex', flexDirection: 'column', gap: 2
                            }}>
                                <StatRow label="Hit Points" stat={player.hp} />
                                <StatRow label="Damage" stat={player.dmg} />
                                <StatRow label="Atk Speed" stat={player.atk} inverse />
                                <StatRow label="Armor" stat={player.arm} extraInfo={`${(0.95 * (calcStat(player.arm) / (calcStat(player.arm) + 5263)) * 100).toFixed(0)}%`} />
                            </div>

                            <div style={{ flex: 1, background: 'rgba(15, 23, 42, 0.6)', padding: 10, borderRadius: 12, border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Acquired Tech</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignContent: 'flex-start', maxHeight: 200, overflowY: 'auto' }}>
                                    {(() => {
                                        // Group by upgrade name and rarity
                                        const upgradeData: Record<string, { count: number, rarityId: string }> = {};
                                        player.upgradesCollected.forEach(upgrade => {
                                            const name = upgrade.type.name;
                                            if (!upgradeData[name]) {
                                                upgradeData[name] = { count: 0, rarityId: upgrade.rarity.id };
                                            }
                                            upgradeData[name].count++;
                                        });

                                        // Get rarity order for sorting (we'll need to import RARITIES)
                                        const rarityOrder = ['junk', 'broken', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'ancient', 'divine'];
                                        const rarityColors: Record<string, string> = {
                                            'junk': '#475569',
                                            'broken': '#78350f',
                                            'common': '#94a3b8',
                                            'uncommon': '#22c55e',
                                            'rare': '#3b82f6',
                                            'epic': '#ec4899',
                                            'legendary': '#f59e0b',
                                            'mythical': '#a855f7',
                                            'ancient': '#facc15',
                                            'divine': '#22d3ee'
                                        };

                                        // Sort entries by rarity (lowest to highest)
                                        const sortedEntries = Object.entries(upgradeData).sort((a, b) => {
                                            const rarityA = a[1].rarityId;
                                            const rarityB = b[1].rarityId;
                                            return rarityOrder.indexOf(rarityA) - rarityOrder.indexOf(rarityB);
                                        });

                                        return sortedEntries.map(([name, data], i) => {
                                            const color = rarityColors[data.rarityId] || '#cbd5e1';
                                            return (
                                                <div key={i} style={{
                                                    fontSize: 11, padding: '5px 10px', background: '#1e293b',
                                                    borderRadius: 4, border: `1px solid ${color}40`,
                                                    display: 'flex', gap: 8, alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <span style={{ color, fontWeight: 600 }}>{name}</span>
                                                    {data.count > 1 && <span style={{ fontWeight: 900, color: '#22d3ee', fontSize: 10 }}>x{data.count}</span>}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                        </div>
                    </div>

                    <button
                        onClick={onRestart}
                        style={{
                            marginTop: 20, width: '100%', maxWidth: 450, padding: '16px 0', background: '#22d3ee', color: '#020617',
                            border: 'none', fontWeight: 900, borderRadius: 8, cursor: 'pointer',
                            fontSize: 14, letterSpacing: 2, textTransform: 'uppercase',
                            boxShadow: '0 0 20px rgba(34, 211, 238, 0.4)',
                            pointerEvents: 'auto'
                        }}
                    >
                        RESTART
                    </button>
                </div>
            )}
        </>
    );
};
