
import React, { useState, useEffect } from 'react';
import type { GameState } from '../../logic/types';
import { CANVAS_WIDTH } from '../../logic/constants';
import { getHexMultiplier, getHexLevel } from '../../logic/LegendaryLogic';

interface PlayerStatusProps {
    gameState: GameState;
    maxHp: number;
}

export const PlayerStatus: React.FC<PlayerStatusProps> = ({ gameState, maxHp }) => {
    const { player } = gameState;
    const [prevHp, setPrevHp] = useState(player.curHp);

    // HP Bar Animation Control
    const currentHpPercent = (player.curHp / maxHp) * 100;
    const prevHpPercent = (prevHp / maxHp) * 100;
    const isHealing = currentHpPercent > prevHpPercent;

    useEffect(() => {
        setPrevHp(player.curHp);
    }, [player.curHp]);

    return (
        <div style={{
            position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
            width: Math.min(CANVAS_WIDTH * 0.8, 300), display: 'flex', flexDirection: 'column', gap: 6, zIndex: 100,
            alignItems: 'center'
        }}>
            {/* CHANNELING BAR (Epicenter) */}
            {(() => {
                const epi = gameState?.areaEffects?.find(ae => ae.type === 'epicenter');
                if (!epi || epi.duration === undefined) return null;
                const pct = Math.max(0, Math.min(100, (epi.duration / 10) * 100));
                return (
                    <div style={{
                        width: '100%', height: 8, background: 'rgba(0,0,0,0.5)',
                        border: '1px solid #22d3ee', borderRadius: 4, marginBottom: 4,
                        position: 'relative', overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${pct}%`, height: '100%',
                            background: 'linear-gradient(90deg, #0ea5e9, #22d3ee)',
                            transition: 'width 0.1s linear'
                        }} />
                        <div style={{
                            position: 'absolute', top: 0, width: '100%', textAlign: 'center',
                            fontSize: 6, fontWeight: 900, color: '#fff', letterSpacing: 1,
                            textShadow: '0 0 2px #000', lineHeight: '8px'
                        }}>
                            CHANNELING
                        </div>
                    </div>
                );
            })()}

            <div style={{ display: 'flex', gap: 8, marginBottom: 4, justifyContent: 'center' }}>
                {/* ACTIVE SKILLS */}
                {player.activeSkills && player.activeSkills.map((skill, idx) => (
                    <div key={idx} style={{
                        width: 40, height: 40,
                        position: 'relative',
                        background: '#0f172a',
                        border: skill.inUse ? '2px solid #22d3ee' : '2px solid #475569',
                        borderRadius: 6,
                        overflow: 'hidden',
                        boxShadow: skill.inUse ? '0 0 10px #22d3ee' : 'none',
                        transition: 'all 0.2s'
                    }}>
                        {/* Icon */}
                        {skill.icon && <img src={skill.icon} alt={skill.type} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: skill.cooldown > 0 ? 0.5 : 1 }} />}

                        {/* Cooldown Overlay */}
                        {skill.cooldown > 0 && (
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, width: '100%',
                                height: `${(skill.cooldown / skill.cooldownMax) * 100}%`,
                                background: 'rgba(0, 0, 0, 0.7)',
                                transition: 'height 0.1s linear'
                            }} />
                        )}
                        {skill.cooldown > 0 && (
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                color: '#fff', fontSize: 10, fontWeight: 900, textShadow: '0 0 2px #000'
                            }}>
                                {Math.ceil(skill.cooldown)}
                            </div>
                        )}

                        {/* Keybind */}
                        <div style={{
                            position: 'absolute', top: 1, left: 3,
                            color: '#fff', fontSize: 8, fontWeight: 900,
                            textShadow: '0 0 2px #000', opacity: 0.8
                        }}>
                            {skill.keyBind}
                        </div>
                    </div>
                ))}

                {/* PASSIVE SKILLS (Always Rendered if acquired) */}
                {(() => {
                    const waveLevel = getHexLevel(gameState, 'ComWave');
                    if (waveLevel <= 0) return null;

                    const shots = player.shotsFired || 0;
                    const required = 15;
                    const progress = (shots % required);
                    const remaining = required - progress;

                    return (
                        <div style={{
                            width: 40, height: 40,
                            position: 'relative',
                            background: 'rgba(15, 23, 42, 0.4)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: 6,
                            overflow: 'hidden',
                        }}>
                            {/* Static Icon for Sonic Wave */}
                            <img src="/assets/hexes/ComWave.png" alt="Sonic Wave" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                            {/* Progress Overlay (fills up as you shoot) */}
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, width: '100%',
                                height: `${(progress / required) * 100}%`,
                                background: 'rgba(56, 189, 248, 0.3)',
                                borderTop: '1px solid rgba(56, 189, 248, 0.6)',
                                transition: 'height 0.1s'
                            }} />

                            {/* Shots Remaining Counter */}
                            <div style={{
                                position: 'absolute', bottom: 1, right: 3,
                                color: '#38BDF8', fontSize: 10, fontWeight: 900,
                                textShadow: '0 0 4px #000'
                            }}>
                                {remaining}
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div style={{
                width: '100%', height: 16, background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #334155', borderRadius: 4, overflow: 'hidden', position: 'relative'
            }}>
                <div style={{
                    width: `${(player.curHp / maxHp) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #ef4444, #f87171)',
                    transition: isHealing ? 'width 0.3s' : 'width 0s'
                }} />
                <div style={{
                    position: 'absolute', width: '100%', textAlign: 'center', top: 0,
                    fontSize: 9, fontWeight: 900, lineHeight: '16px', color: '#fff'
                }}>
                    {Math.ceil(player.curHp)} / {Math.ceil(maxHp)}
                </div>
            </div>

            {/* Shield Bar (Blue) */}
            {(() => {
                const totalShield = (player.shieldChunks || []).reduce((sum, c) => sum + c.amount, 0);
                if (totalShield <= 0) return null;
                const effMult = getHexMultiplier(gameState, 'ComLife');
                const dynamicMaxShield = maxHp * effMult;
                const shieldPct = (totalShield / dynamicMaxShield) * 100;
                return (
                    <div style={{
                        width: '100%', height: 10, background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: 2, overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <div style={{
                            width: `${Math.min(100, shieldPct)}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                            boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)',
                            transition: 'width 0.3s ease-out'
                        }} />
                        <div style={{
                            position: 'absolute', width: '100%', textAlign: 'center', top: 0,
                            fontSize: 7, fontWeight: 900, lineHeight: '10px', color: '#fff',
                            textShadow: '0 0 2px #000'
                        }}>
                            {Math.ceil(totalShield)} / {Math.ceil(dynamicMaxShield)}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
