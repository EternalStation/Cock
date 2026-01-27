import React, { useEffect, useState } from 'react';
import type { GameState, UpgradeChoice } from '../logic/types';
import { calcStat } from '../logic/MathUtils';
import { CANVAS_WIDTH } from '../logic/constants';
import { playUpgradeSfx } from '../logic/AudioLogic';
import { getArenaIndex, SECTOR_NAMES } from '../logic/MapLogic';

import { UpgradeCard } from './UpgradeCard';
import { Minimap } from './Minimap';

interface HUDProps {
    gameState: GameState;
    upgradeChoices: UpgradeChoice[] | null;
    onUpgradeSelect: (c: UpgradeChoice) => void;
    gameOver: boolean;
    onRestart: () => void;
    bossWarning: number | null;
    fps: number;
    onInventoryToggle: () => void;
}

export const HUD: React.FC<HUDProps> = ({ gameState, upgradeChoices, onUpgradeSelect, gameOver, bossWarning, fps, onInventoryToggle }) => {
    const { player, score, gameTime } = gameState;
    const { xp } = player;

    // Dynamic Max HP calculation for HUD (matches logic in PlayerLogic)
    let maxHp = calcStat(player.hp);
    if (getArenaIndex(player.x, player.y) === 2) {
        maxHp *= 1.2; // +20% Max HP in Defence Hex
    }

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
            const code = e.code.toLowerCase();

            if (key === 'a' || code === 'keya' || code === 'arrowleft' || key === 'arrowleft') {
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : upgradeChoices.length - 1));
            }
            if (key === 'd' || code === 'keyd' || code === 'arrowright' || key === 'arrowright') {
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
                    {/* Top Left UI Group */}
                    <div style={{ position: 'absolute', top: 15, left: 15, pointerEvents: 'none', zIndex: 10 }}>
                        <div className="kills" style={{ color: '#22d3ee', textShadow: '0 0 10px rgba(34, 211, 238, 0.5)', fontSize: 24, fontWeight: 800 }}>
                            {score.toString().padStart(4, '0')}
                        </div>
                        <div className="stat-row" style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: 1 }}>
                            LVL {player.level}
                        </div>
                        <div className="stat-row" style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: 1 }}>
                            {Math.floor(gameTime / 60)}:{Math.floor(gameTime % 60).toString().padStart(2, '0')}
                        </div>

                        <style>{`
                            @keyframes hud-breath {
                                0% { transform: scale(1); opacity: 0.85; filter: brightness(1); }
                                50% { transform: scale(1.1); opacity: 1; filter: brightness(1.5); }
                                100% { transform: scale(1); opacity: 0.85; filter: brightness(1); }
                            }
                        `}</style>
                        {(() => {
                            const arenaIdx = getArenaIndex(player.x, player.y);

                            const PulseLabel = ({ title, buff, color, duration }: { title: string, buff: string, color: string, duration: string }) => (
                                <div style={{
                                    marginTop: 6, display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '5px 12px', background: `${color}1A`,
                                    border: `1px solid ${color}80`,
                                    borderRadius: 6,
                                    animation: `hud-breath ${duration} infinite ease-in-out`,
                                    boxShadow: `0 0 15px ${color}22`,
                                    width: 'fit-content',
                                    pointerEvents: 'none',
                                    backdropFilter: 'blur(2px)',
                                    transformOrigin: 'left center'
                                }}>
                                    <div style={{
                                        width: 10, height: 10, background: color, borderRadius: '50%',
                                        boxShadow: `0 0 10px ${color}`
                                    }} />
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span style={{
                                            color, fontSize: 10, fontWeight: 950, letterSpacing: 1,
                                            textTransform: 'uppercase', textShadow: `0 0 8px ${color}66`
                                        }}>{title}:</span>
                                        <span style={{
                                            color: '#fff', fontSize: 10, fontWeight: 800
                                        }}>{buff}</span>
                                    </div>
                                </div>
                            );

                            if (arenaIdx === 0) {
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <PulseLabel title="Econ Hex" buff="+15% XP Gain" color="#22d3ee" duration="2.5s" />
                                        <PulseLabel title="Econ Hex" buff="+15% Meteorite Chance" color="#22d3ee" duration="2.5s" />
                                    </div>
                                );
                            } else if (arenaIdx === 1) {
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <PulseLabel title="Combat Hex" buff="+15% Spawn Rate" color="#ef4444" duration="2.0s" />
                                        <PulseLabel title="Combat Hex" buff="+15% Collision Dmg" color="#ef4444" duration="2.0s" />
                                    </div>
                                );
                            } else if (arenaIdx === 2) {
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <PulseLabel title="Defence Hex" buff="+20% Max HP" color="#3b82f6" duration="3.0s" />
                                        <PulseLabel title="Defence Hex" buff="+20% HP Regen" color="#3b82f6" duration="3.0s" />
                                    </div>
                                );
                            }
                            return null;
                        })()}





                        {/* STUN INDICATOR */}
                        {player.stunnedUntil && Date.now() < player.stunnedUntil && (
                            <div style={{
                                marginTop: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '2px 8px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                                borderRadius: 4,
                                animation: 'pulse 0.2s infinite',
                                boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)'
                            }}>
                                <div style={{
                                    width: 8, height: 8, background: '#EF4444',
                                    borderRadius: '50%', boxShadow: '0 0 8px #EF4444'
                                }} />
                                <span style={{ color: '#EF4444', fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
                                    ENGINE DISABLED ({Math.ceil((player.stunnedUntil - Date.now()) / 1000)}s)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Bottom Right UI Group */}
                    <div style={{
                        position: 'absolute', bottom: 15, right: 15,
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 12
                    }}>
                        {/* INVENTORY / METEORITE INDICATOR (Moved to bottom right, clickable) */}
                        <div
                            onClick={onInventoryToggle}
                            style={{
                                position: 'relative',
                                width: 52,
                                height: 52,
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '2px solid rgba(148, 163, 184, 0.4)',
                                borderRadius: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 20px rgba(0,0,0,0.5), inset 0 0 10px rgba(125, 211, 252, 0.1)',
                                backdropFilter: 'blur(8px)',
                                pointerEvents: 'auto',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1) translateY(-4px)';
                                e.currentTarget.style.borderColor = 'rgba(125, 211, 252, 0.6)';
                                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.6), 0 0 15px rgba(125, 211, 252, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                                e.currentTarget.style.boxShadow = '0 0 20px rgba(0,0,0,0.5), inset 0 0 10px rgba(125, 211, 252, 0.1)';
                            }}
                        >
                            {/* Meteorite Icon (SVG) - Jagged Rock Shape */}
                            <svg viewBox="0 0 100 100" width="34" height="34" style={{ filter: 'drop-shadow(0 0 8px #7dd3fc)' }}>
                                <path
                                    d="M30 20 L75 15 L90 40 L80 80 L50 90 L20 75 L10 45 Z"
                                    fill="none"
                                    stroke="#7dd3fc"
                                    strokeWidth="6"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M40 35 L65 30 L80 45 L70 70 L45 75 L30 60 Z"
                                    fill="#7dd3fc"
                                    opacity="0.6"
                                />
                                {/* Small craters/details */}
                                <circle cx="45" cy="45" r="4.5" fill="#7dd3fc" opacity="0.8" />
                                <circle cx="65" cy="62" r="3.5" fill="#7dd3fc" opacity="0.8" />
                                <circle cx="35" cy="65" r="2.5" fill="#7dd3fc" opacity="0.8" />
                            </svg>

                            {/* Unseen Badge */}
                            {gameState.unseenMeteorites > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: -10,
                                    right: -10,
                                    background: '#ef4444',
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 900,
                                    minWidth: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 5px',
                                    border: '2px solid #020617',
                                    boxShadow: '0 0 15px rgba(239, 68, 68, 0.7)',
                                    animation: 'pulse 1s infinite'
                                }}>
                                    {gameState.unseenMeteorites}
                                </div>
                            )}
                        </div>

                        {/* FPS Counter */}
                        <span style={{
                            color: fps >= 50 ? '#4ade80' : fps >= 30 ? '#facc15' : '#ef4444',
                            fontFamily: 'monospace',
                            fontSize: 14,
                            fontWeight: 900,
                            letterSpacing: '1px',
                            textShadow: '0 0 5px rgba(0,0,0,0.8)',
                            pointerEvents: 'none'
                        }}>
                            {fps}
                        </span>
                    </div>

                    {/* Right Side Alerts Group */}
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                        {bossWarning !== null && (
                            <div id="boss-warning" className="glitch-text" style={{
                                position: 'absolute', top: 15, right: 15, textAlign: 'right',
                                color: '#ef4444', fontWeight: 900, letterSpacing: 1, fontSize: 24
                            }}>
                                ANOMALY DETECTED: {Math.ceil(bossWarning)}s
                            </div>
                        )}

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

                        {gameState.portalState === 'warn' && (
                            <div className="glitch-text" style={{
                                position: 'absolute', top: 85, right: 15, textAlign: 'right',
                                animation: 'pulse 0.5s infinite alternate'
                            }}>
                                <div style={{ color: '#00FFFF', fontWeight: 900, letterSpacing: 1, fontSize: 20 }}>
                                    DIMENSIONAL RIFT OPENING
                                </div>
                                <div style={{ color: '#fff', fontWeight: 700, letterSpacing: 2, fontSize: 14, marginTop: 2 }}>
                                    T-MINUS {Math.ceil(gameState.portalTimer)}s
                                </div>
                            </div>
                        )}
                        {gameState.portalState === 'open' && (
                            <div className="glitch-text" style={{
                                position: 'absolute', top: 85, right: 15, textAlign: 'right',
                                animation: gameState.portalTimer <= 5 ? 'pulse 0.2s infinite' : 'pulse 1s infinite'
                            }}>
                                <div style={{ color: gameState.portalTimer <= 5 ? '#FF0000' : '#00FF00', fontWeight: 900, letterSpacing: 1, fontSize: 20 }}>
                                    {gameState.portalTimer <= 5 ? "PORTAL CLOSING" : "PORTAL ACTIVE"}
                                </div>
                                <div style={{ color: '#fff', fontWeight: 700, letterSpacing: 2, fontSize: 14, marginTop: 2 }}>
                                    CLOSING IN {Math.ceil(gameState.portalTimer)}s
                                </div>
                            </div>
                        )}
                    </div>

                    {/* XP Bar */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 6, background: '#000', zIndex: 100 }}>
                        <div style={{
                            width: `${(xp.current / xp.needed) * 100}%`,
                            height: '100%',
                            background: '#4ade80',
                            boxShadow: '0 0 15px #4ade80',
                            transition: 'width 0.2s'
                        }} />
                    </div>

                    {/* BOSS HP BAR */}
                    {(() => {
                        const boss = gameState.enemies.find(e => e.boss && !e.dead);
                        const hasBoss = !!boss;
                        const hpPct = boss ? (boss.hp / boss.maxHp) * 100 : 0;
                        const sectorIdx = getArenaIndex(player.x, player.y);
                        const sectorName = SECTOR_NAMES[sectorIdx] || "UNKNOWN SECTOR";

                        return (
                            <>
                                {hasBoss && (
                                    <div style={{
                                        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                                        width: 500, height: 12, background: 'rgba(0,0,0,0.7)', border: '1px solid #ef4444',
                                        borderRadius: 2, overflow: 'hidden', zIndex: 100,
                                        boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)'
                                    }}>
                                        <div style={{
                                            width: `${hpPct}%`, height: '100%',
                                            background: 'linear-gradient(90deg, #ef4444, #991b1b)',
                                            transition: 'width 0.1s linear'
                                        }} />
                                        <div style={{
                                            position: 'absolute', width: '100%', textAlign: 'center', top: 0,
                                            color: '#fff', fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                                            letterSpacing: 2, lineHeight: '12px', textShadow: '0 0 4px #000'
                                        }}>
                                            {boss.type === 'boss' ? 'ANOMALY DETECTED' : boss.type}
                                        </div>
                                    </div>
                                )}

                                {/* SECTOR NAME INDICATOR */}
                                <div style={{
                                    position: 'absolute',
                                    top: hasBoss ? 45 : 20,
                                    left: '50%', transform: 'translateX(-50%)',
                                    zIndex: 90,
                                    transition: 'top 0.5s ease-in-out',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: '1px solid #1e293b',
                                        borderLeft: '4px solid #3b82f6',
                                        borderRight: '4px solid #3b82f6',
                                        padding: '4px 20px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 0 15px rgba(0,0,0,0.5)'
                                    }}>
                                        <span style={{
                                            color: '#94a3b8',
                                            fontFamily: 'monospace',
                                            fontSize: 10,
                                            fontWeight: 900,
                                            letterSpacing: 3,
                                            textTransform: 'uppercase',
                                            textShadow: '0 0 8px rgba(59, 130, 246, 0.5)'
                                        }}>
                                            // SECTOR 0{sectorIdx + 1}: {sectorName} //
                                        </span>
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {/* HP Bar */}
                    <div style={{
                        position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                        width: Math.min(CANVAS_WIDTH * 0.8, 250), height: 16, background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid #334155', borderRadius: 20, overflow: 'hidden', zIndex: 100
                    }}>
                        <div style={{
                            width: `${(player.curHp / maxHp) * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #ef4444, #f87171)',
                            boxShadow: 'none',
                            transition: isHealing ? 'width 0.3s' : 'width 0s'
                        }} />
                        <div style={{
                            position: 'absolute', width: '100%', textAlign: 'center', top: 0,
                            fontSize: 9, fontWeight: 900, lineHeight: '16px', color: '#fff'
                        }}>
                            {Math.ceil(player.curHp)} / {Math.ceil(maxHp)}
                        </div>
                    </div>

                    {/* Minimap */}
                    <Minimap gameState={gameState} />

                    {/* Upgrade Menu */}
                    {upgradeChoices && (
                        <div className="upgrade-menu-overlay" style={{ zIndex: 1000 }}>
                            <div className="fog-layer" />
                            <div className="fog-pulse" />
                            <div className="honeycomb-layer">
                                <div className="honeycomb-cluster" style={{ top: '10%', left: '10%' }} />
                                <div className="honeycomb-cluster" style={{ bottom: '20%', right: '15%' }} />
                            </div>

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
            )
            }
        </>
    );
};
