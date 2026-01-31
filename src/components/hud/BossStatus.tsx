
import React from 'react';
import type { GameState } from '../../logic/types';
import { getArenaIndex, SECTOR_NAMES } from '../../logic/MapLogic';

interface BossStatusProps {
    gameState: GameState;
}

export const BossStatus: React.FC<BossStatusProps> = ({ gameState }) => {
    const { player } = gameState;
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
};
