import React, { useEffect, useState } from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';
import { calcStat } from '../logic/MathUtils';
import { CANVAS_WIDTH, BONUSES } from '../logic/constants';
import { getIcon } from './UpgradeIcons';
import { playUpgradeSfx } from '../logic/AudioLogic';


interface HUDProps {
    gameState: GameState;
    upgradeChoices: UpgradeChoice[] | null;
    onUpgradeSelect: (c: UpgradeChoice) => void;
    bossWarning: number | null;
}

export const HUD: React.FC<HUDProps> = ({ gameState, upgradeChoices, onUpgradeSelect, bossWarning }) => {
    const { player, score, gameTime } = gameState;
    const { xp } = player;
    const maxHp = calcStat(player.hp);

    // Upgrade Nav
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSelecting, setIsSelecting] = useState(false);

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
            const key = e.key.toLowerCase();
            // A/D for horizontal navigation
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
            const key = e.key.toLowerCase();
            if (key === ' ' || key === 'enter') {
                if (isSelecting) return;
                const choice = upgradeChoices[selectedIndex];
                if (choice.rarity) playUpgradeSfx(choice.rarity.id);
                setIsSelecting(true);
                setTimeout(() => {
                    onUpgradeSelect(choice);
                    setIsSelecting(false);
                }, 150);
            }
        };
        window.addEventListener('keydown', handleSelect);
        return () => window.removeEventListener('keydown', handleSelect);
    }, [upgradeChoices, selectedIndex, onUpgradeSelect, isSelecting]);


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

            {/* RARE SIGNAL NOTIFICATION */}
            {gameState.enemies.some(e => e.isRare && e.rarePhase === 0) && (
                <div className="glitch-text" style={{
                    position: 'absolute', top: 60, right: 15, textAlign: 'right',
                    color: '#F59E0B', fontWeight: 900, letterSpacing: 3, fontSize: 14,
                    textShadow: '0 0 10px #F59E0B', zIndex: 200
                }}>
                    UNKNOWN SIGNAL DETECTED<br />
                    <span style={{ fontSize: 10, opacity: 0.8 }}>SEARCH THE PERIMETER</span>
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
                    {Math.ceil(player.curHp)} / {Math.floor(maxHp)}
                </div>
            </div>

            {/* Upgrade Modal */}
            {upgradeChoices && (
                <div className="modal-overlay">
                    <h2 style={{ marginBottom: 15, color: '#22d3ee', fontSize: 22, textTransform: 'uppercase', letterSpacing: 4 }}>
                        {upgradeChoices[0].isSpecial ? "VOID TECHNOLOGY ACQUIRED" : "SYSTEM EVOLUTION"}
                    </h2>

                    {gameState.rareRewardActive && (
                        <div className="glitch-text" style={{
                            color: '#FFD700', fontSize: 14, fontWeight: 900, marginBottom: 20,
                            letterSpacing: 2, textShadow: '0 0 10px #FFD700', animation: 'pulse 0.5s infinite'
                        }}>
                            ⚡ INCREASED CHANCE OF GETTING RARE UPGRADE DROP ⚡
                        </div>
                    )}

                    <div className="upgrade-container">
                        {upgradeChoices.map((c, i) => {
                            const isSelected = i === selectedIndex;
                            const rId = c.rarity?.id || 'common';
                            const color = c.rarity?.color || '#94a3b8';
                            // Simplify: 1-5 scale based on rarity list index roughly
                            const rarities = ['junk', 'broken', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical', 'divine'];
                            const rIndex = rarities.indexOf(rId);
                            const filledDiamonds = Math.max(1, Math.min(5, Math.ceil((rIndex + 1) / 2)));

                            // Calc Value
                            let valStr = '';
                            if (!c.isSpecial && c.type && c.rarity) {
                                const id = c.type.id || '';
                                const key = id.replace('_f', '').replace('_m', '');
                                const b = BONUSES[rId];
                                if (b) {
                                    const val = b[key] ?? b[id] ?? 0;
                                    valStr = id.endsWith('_m') ? `+${val}%` : `+${val}`;
                                }
                            }

                            return (
                                <div
                                    key={i}
                                    className={`upgrade-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => {
                                        if (isSelecting) return;
                                        if (c.rarity) playUpgradeSfx(c.rarity.id);
                                        setIsSelecting(true);
                                        setTimeout(() => {
                                            onUpgradeSelect(c);
                                            setIsSelecting(false);
                                        }, 150);
                                    }}
                                    onMouseEnter={() => setSelectedIndex(i)}
                                    style={{ '--neon-cyan': color, borderColor: isSelected ? color : '#334155' } as React.CSSProperties}
                                >
                                    {/* Top: Icon & Value */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                        <div className="card-icon" style={{ color: color }}>
                                            {c.type ? getIcon(c.type.icon, color) : null}
                                        </div>

                                        <div className="card-title" style={{ color: isSelected ? '#fff' : '#cbd5e1' }}>
                                            {c.type?.name || 'Unknown'}
                                        </div>

                                        {valStr && (
                                            <div style={{
                                                background: color, color: '#000', padding: '2px 12px',
                                                borderRadius: 4, fontWeight: 900, fontSize: 16, marginTop: 8
                                            }}>
                                                {valStr} {c.type?.name.split(' ')[0]} {/* e.g. +10 DAMAGE */}
                                            </div>
                                        )}
                                    </div>

                                    {/* Middle: Description */}
                                    <div className="card-description">
                                        {c.type?.desc || 'No system details available.'}
                                    </div>

                                    {/* Bottom: Rarity Diamonds */}
                                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div className="rarity-diamonds">
                                            {Array.from({ length: 5 }).map((_, dIdx) => (
                                                <div
                                                    key={dIdx}
                                                    className={`diamond ${dIdx < filledDiamonds ? 'filled' : ''}`}
                                                    style={{ color: color }}
                                                />
                                            ))}
                                        </div>
                                        <div className="rarity-label" style={{ color }}>{c.rarity?.label}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

        </>
    );
};
