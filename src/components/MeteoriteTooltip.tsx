import type { GameState, Meteorite, MeteoriteRarity } from '../logic/types';
import './MeteoriteTooltip.css';
import { calculateMeteoriteEfficiency } from '../logic/EfficiencyLogic';

interface MeteoriteTooltipProps {
    meteorite: Meteorite;
    gameState: GameState;
    meteoriteIdx?: number; // Optional index if placed in socket
    x: number;
    y: number;
}

const RARITY_COLORS: Record<MeteoriteRarity, string> = {
    scrap: '#9ca3af',
    anomalous: '#14b8a6',
    quantum: '#06b6d4',
    astral: '#a855f7',
    radiant: '#eab308',
    void: '#7c3aed',
    eternal: '#f43f5e'
};

const getMeteoriteImage = (m: Meteorite) => {
    return `/assets/meteorites/M${m.visualIndex}${m.quality}.png`;
};

const RARITY_INFO: Record<MeteoriteRarity, { name: string, symbol: string }> = {
    scrap: { name: 'SALVAGED FRAGMENT', symbol: '◈' },
    anomalous: { name: 'ANOMALOUS SHARD', symbol: '⬢' },
    quantum: { name: 'QUANTUM CORE', symbol: '◆' },
    astral: { name: 'ASTRAL SEED', symbol: '★' },
    radiant: { name: 'RADIANT STAR', symbol: '✦' },
    void: { name: 'VOID CATALYST', symbol: '❂' },
    eternal: { name: 'ETERNAL CORE', symbol: '✵' }
};

export const MeteoriteTooltip: React.FC<MeteoriteTooltipProps> = ({ meteorite, gameState, meteoriteIdx = -1, x }) => {
    const rarityColor = RARITY_COLORS[meteorite.rarity];
    const info = RARITY_INFO[meteorite.rarity];

    const efficiency = meteoriteIdx !== -1
        ? calculateMeteoriteEfficiency(gameState, meteoriteIdx)
        : { totalBoost: 0, perkResults: {} };

    // Calculate how many stats we have
    const activeStatsCount = meteorite.perks ? meteorite.perks.length : 0;

    const CARD_WIDTH = 280;
    // Base height increased to 340 to accommodate full header/footer + 140px image
    const CARD_HEIGHT = 340 + (activeStatsCount * 36);
    const OFFSET = 20;

    // Final positioning: Centered vertically on screen, horizontal follows cursor
    let finalX = x + OFFSET;
    const finalY = (window.innerHeight - CARD_HEIGHT) / 2;

    if (finalX + CARD_WIDTH > window.innerWidth) {
        finalX = x - CARD_WIDTH - OFFSET;
    }

    const tooltipStyle: React.CSSProperties = {
        position: 'fixed',
        left: finalX,
        top: finalY,
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        zIndex: 5000,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        border: `3px solid ${rarityColor}`,
        background: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
        boxShadow: `0 0 30px ${rarityColor}44`,
        ['--rarity-color' as any]: rarityColor
    };

    return (
        <div style={tooltipStyle} className="meteorite-card-pulse">
            {/* Header: Name + Symbol + Total Power */}
            <div style={{
                padding: '12px 10px',
                borderBottom: `2px solid ${rarityColor}66`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: `${rarityColor}11`
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 900,
                        color: '#fff',
                        letterSpacing: '1px'
                    }}>{info.name}</span>
                    <div style={{
                        marginTop: '2px',
                        fontSize: '10px',
                        fontWeight: 900,
                        color: rarityColor,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <span style={{ opacity: 0.6, fontSize: '8px' }}>ACTIVE POWER:</span>
                        <span>+{Math.round(efficiency.totalBoost * 100)}%</span>
                        {meteoriteIdx === -1 && <span style={{ fontSize: '7px', opacity: 0.5, marginLeft: '4px' }}>(UNPLACED)</span>}
                    </div>
                </div>
                <span style={{
                    fontSize: '16px',
                    color: rarityColor,
                    textShadow: `0 0 10px ${rarityColor}`
                }}>{info.symbol}</span>
            </div>

            {/* Illustration Area (Unchanged) */}
            <div style={{
                flex: '0 0 140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `radial-gradient(circle, ${rarityColor}33 0%, transparent 70%)`,
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    opacity: 0.1,
                    backgroundImage: `linear-gradient(${rarityColor} 1px, transparent 1px), linear-gradient(90deg, ${rarityColor} 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                }} />
                <img
                    src={getMeteoriteImage(meteorite)}
                    alt={meteorite.rarity}
                    style={{
                        width: '110px',
                        height: '110px',
                        objectFit: 'contain',
                        filter: `drop-shadow(0 0 15px ${rarityColor})`
                    }}
                />
            </div>

            {/* Protocols Label */}
            <div style={{
                padding: '4px 10px',
                fontSize: '8px',
                color: rarityColor,
                fontWeight: 900,
                letterSpacing: '2px',
                backgroundColor: `${rarityColor}22`,
                textAlign: 'center',
                textTransform: 'uppercase'
            }}>
                Augmentation Protocols
            </div>

            {/* Stats Area with Active/Inactive Logic */}
            <div style={{
                flex: 1,
                padding: '12px 15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
            }}>
                {meteorite.perks && meteorite.perks.map((perk, idx) => {
                    const perkResult = efficiency.perkResults[perk.id];
                    const isActive = perkResult && perkResult.count > 0;

                    const getPerkIcon = (id: string) => {
                        if (id.includes('neighbor_any')) return '⚙';
                        if (id.includes('neighbor_new') || id.includes('neighbor_dam') || id.includes('neighbor_bro')) return '◈';
                        if (id.includes('_leg')) return '⌬';
                        if (id.includes('pair')) return '🝔';
                        return '◈';
                    };

                    const getPerkName = (id: string) => {
                        if (id === 'neighbor_any_all') return 'UNIVERSAL SYNERGY';
                        if (id.includes('eco')) return 'ECONOMIC RESONANCE';
                        if (id.includes('com')) return 'COMBAT AMPLIFIER';
                        if (id.includes('def')) return 'DEFENCE MATRIX';
                        if (id.includes('pair')) return 'HARMONIC PAIRING';
                        return 'METEORIC PROTOCOL';
                    };

                    return (
                        <div key={idx} className="card-stat-line" style={{
                            alignItems: 'flex-start',
                            paddingRight: '6px'
                        }}>
                            <span className="bullet" style={{ color: isActive ? rarityColor : '#94a3b8', marginTop: '2px', opacity: isActive ? 1 : 0.6 }}>
                                {getPerkIcon(perk.id)}
                            </span>
                            <div className="content" style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                        <span className="label" style={{ fontSize: '7px', opacity: 0.9, fontWeight: 900 }}>{getPerkName(perk.id)}</span>
                                        <span style={{ fontSize: '7px', color: rarityColor, opacity: 0.5 }}>({perk.range.min}-{perk.range.max}%)</span>
                                    </div>
                                    <span className="value" style={{
                                        fontSize: '11px',
                                        color: isActive ? '#fff' : '#94a3b8',
                                        opacity: isActive ? 1 : 0.4,
                                        fontWeight: 900,
                                        marginLeft: '12px',
                                        textAlign: 'right'
                                    }}>
                                        +{isActive ? perkResult.activeValue : perk.value}%
                                    </span>
                                </div>
                                <div style={{ fontSize: '8px', color: '#94a3b8', lineHeight: '1.2', marginTop: '1px', opacity: 0.9 }}>
                                    {perk.description}
                                    {isActive && perkResult.count > 1 && <span style={{ color: '#FCD34D' }}> (x{perkResult.count})</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer / Info Panel */}
            <div style={{
                padding: '10px 15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderTop: `1px solid ${rarityColor}33`,
                background: 'rgba(0,0,0,0.5)',
                fontSize: '10px',
                letterSpacing: '0.5px',
                fontWeight: 900,
                textTransform: 'uppercase'
            }}>
                <div style={{ color: '#fff' }}>
                    <span style={{ color: rarityColor, opacity: 0.8 }}>TYPE:</span> {meteorite.quality === 'New' ? 'PRISTINE' : meteorite.quality.toUpperCase()}
                </div>
                <div style={{ color: '#fff' }}>
                    <span style={{ color: rarityColor, opacity: 0.8 }}>DISCOVERED IN:</span> {meteorite.discoveredIn}
                </div>
                <div style={{ color: rarityColor }}>
                    <span style={{ opacity: 0.8 }}>RARITY:</span> {meteorite.rarity.toUpperCase()}
                </div>
            </div>
        </div>
    );
};
