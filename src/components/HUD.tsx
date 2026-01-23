import React, { useEffect, useState } from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';
import { calcStat } from '../logic/MathUtils';
import { CANVAS_WIDTH } from '../logic/constants';
import { playUpgradeSfx } from '../logic/AudioLogic';

import { UpgradeCard } from './UpgradeCard';

interface HUDProps {
    gameState: GameState;
    upgradeChoices: UpgradeChoice[] | null;
    onUpgradeSelect: (c: UpgradeChoice) => void;
    gameOver: boolean;
    onRestart: () => void;
    bossWarning: number | null;
}

export const HUD: React.FC<HUDProps> = ({ gameState, upgradeChoices, onUpgradeSelect, gameOver, bossWarning }) => {
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

    // Snitch Alert Logic: Show only if Snitch exists AND is in Phase 0 (Passive/Hidden)
    const activeSnitch = gameState.enemies.find(e => e.isRare);
    const showSnitchAlert = activeSnitch && activeSnitch.rarePhase === 0;

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
            {!gameOver && (
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
                            color: '#ef4444', fontWeight: 900, letterSpacing: 1, fontSize: 24
                        }}>
                            ANOMALY DETECTED: {Math.ceil(bossWarning)}s
                        </div>
                    )}

                    {/* Snitch Active Warning */}
                    {showSnitchAlert && (
                        <div className="glitch-text" style={{
                            position: 'absolute', top: 45, right: 15, textAlign: 'right',
                            animation: 'pulse 0.5s infinite alternate'
                        }}>
                            <div style={{ color: '#facc15', fontWeight: 900, letterSpacing: 1, fontSize: 24 }}>
                                ANOMALY DETECTED
                            </div>
                            <div style={{ color: '#fef08a', fontWeight: 700, letterSpacing: 2, fontSize: 16, marginTop: 4 }}>
                                SEARCH SURROUNDINGS
                            </div>
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
                                    fontSize: 24,
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
                </>
            )}
        </>
    );
};
