import React from 'react';
import type { LegendaryHex } from '../logic/types';

interface LegendarySelectionMenuProps {
    options: LegendaryHex[];
    onSelect: (selection: LegendaryHex) => void;
}

export const LegendarySelectionMenu: React.FC<LegendarySelectionMenuProps> = ({ options, onSelect }) => {
    const getLegendaryInfo = (type: string) => {
        switch (type) {
            case 'hp_per_kill': return { icon: '✚', color: '#f87171', label: 'HEALTH' };
            case 'ats_per_kill': return { icon: '⚡', color: '#fbbf24', label: 'ATK SPEED' };
            case 'xp_per_kill': return { icon: '✨', color: '#c084fc', label: 'EXPERIENCE' };
            case 'dmg_per_kill': return { icon: '⚔', color: '#fb7185', label: 'DAMAGE' };
            case 'reg_per_kill': return { icon: '❤', color: '#4ade80', label: 'REGEN' };
            default: return { icon: '★', color: '#fbbf24', label: '??' };
        }
    };

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(5, 5, 20, 0.9)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 3000, fontFamily: 'Orbitron, sans-serif', color: 'white'
        }}>
            <h1 style={{
                fontSize: '3rem', color: '#fbbf24', textShadow: '0 0 20px #fbbf24',
                letterSpacing: '10px', marginBottom: '50px'
            }}>
                LEGENDARY RECOVERY
            </h1>

            <div style={{ display: 'flex', gap: '30px' }}>
                {options.map((opt, i) => {
                    const info = getLegendaryInfo(opt.type);
                    return (
                        <div
                            key={i}
                            onClick={() => onSelect(opt)}
                            style={{
                                width: '300px', height: '450px',
                                background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%)',
                                border: `3px solid ${info.color}`,
                                borderRadius: '15px',
                                padding: '30px',
                                cursor: 'pointer',
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                transition: 'all 0.3s ease',
                                boxShadow: `0 0 15px ${info.color}44`,
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-10px) scale(1.05)';
                                e.currentTarget.style.boxShadow = `0 0 40px ${info.color}88`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                e.currentTarget.style.boxShadow = `0 0 15px ${info.color}44`;
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: '10px', right: '10px',
                                color: info.color, fontSize: '0.8rem', fontWeight: 'bold'
                            }}>
                                {opt.level > 1 ? `UPGRADE (LVL ${opt.level})` : 'NEW MODULE'}
                            </div>

                            <div style={{
                                width: '120px', height: '120px', border: `2px solid ${info.color}`,
                                borderRadius: '50%', marginBottom: '30px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem',
                                color: info.color, background: `${info.color}11`,
                                boxShadow: `inset 0 0 20px ${info.color}22, 0 0 15px ${info.color}44`
                            }}>
                                {info.icon}
                            </div>

                            <h2 style={{ color: info.color, fontSize: '1.4rem', textAlign: 'center', marginBottom: '15px', textShadow: `0 0 10px ${info.color}aa` }}>
                                {opt.name}
                            </h2>

                            <p style={{ color: '#94a3b8', fontSize: '1rem', textAlign: 'center', lineHeight: '1.6', fontWeight: 500 }}>
                                {opt.desc}
                            </p>

                            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                <div style={{ color: '#22d3ee', fontSize: '0.8rem', letterSpacing: '2px', fontWeight: 'bold' }}>
                                    {opt.category.toUpperCase()} ARENA
                                </div>
                                <div style={{ color: info.color, fontSize: '0.7rem', opacity: 0.6 }}>
                                    ID: {opt.id.split('_')[1].toUpperCase()}-X99
                                </div>
                            </div>

                            {/* Animated Glow Line */}
                            <div className="legendary-glow-line" style={{
                                position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px',
                                background: info.color, boxShadow: `0 0 15px ${info.color}`
                            }} />
                        </div>
                    );
                })}
            </div>

            <p style={{ marginTop: '40px', color: '#64748b', fontSize: '0.9rem' }}>
                Recovered technology must be manually integrated in the Module Matrix.
            </p>

            <style>{`
                @keyframes legendaryPulse {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }
                .legendary-glow-line {
                    animation: legendaryPulse 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};
