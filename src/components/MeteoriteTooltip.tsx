import React from 'react';
import type { Meteorite, MeteoriteRarity } from '../logic/types';
import './MeteoriteTooltip.css';

interface MeteoriteTooltipProps {
    meteorite: Meteorite;
    x: number;
    y: number;
}

const RARITY_COLORS: Record<MeteoriteRarity, string> = {
    scrap: '#9ca3af',
    anomalous: '#14b8a6',
    quantum: '#06b6d4',
    astral: '#a855f7',
    radiant: '#eab308'
};

const RARITY_IMAGES: Record<MeteoriteRarity, string> = {
    scrap: '/assets/meteorites/scrapNoBackgound.png',
    anomalous: '/assets/meteorites/anomalousNoBackgound.png',
    quantum: '/assets/meteorites/quantumNoBackgound.png',
    astral: '/assets/meteorites/astralNoBackgound.png',
    radiant: '/assets/meteorites/radiantNoBackgound.png'
};

const RARITY_INFO: Record<MeteoriteRarity, { name: string, symbol: string }> = {
    scrap: { name: 'SALVAGED FRAGMENT', symbol: '◈' },
    anomalous: { name: 'ANOMALOUS SHARD', symbol: '⬢' },
    quantum: { name: 'QUANTUM CORE', symbol: '◆' },
    astral: { name: 'ASTRAL SEED', symbol: '★' },
    radiant: { name: 'RADIANT STAR', symbol: '✦' }
};

export const MeteoriteTooltip: React.FC<MeteoriteTooltipProps> = ({ meteorite, x, y }) => {
    const rarityColor = RARITY_COLORS[meteorite.rarity];
    const info = RARITY_INFO[meteorite.rarity];

    // Calculate how many stats we have
    const activeStatsCount = Object.keys(meteorite.stats).length;

    const CARD_WIDTH = 240;
    // Base height (header + image + protocols label + footer) adjusted to ~270
    const CARD_HEIGHT = 270 + (activeStatsCount * 28);
    const OFFSET = 20;

    // Boundary Detection
    let finalX = x + OFFSET;
    let finalY = y + OFFSET;

    // Flip horizontally if off-screen right
    if (finalX + CARD_WIDTH > window.innerWidth) {
        finalX = x - CARD_WIDTH - OFFSET;
    }

    // Flip vertically if off-screen bottom
    if (finalY + CARD_HEIGHT > window.innerHeight) {
        finalY = y - CARD_HEIGHT - OFFSET;
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
        overflow: 'hidden',
        ['--rarity-color' as any]: rarityColor
    };

    return (
        <div style={tooltipStyle} className="meteorite-card-pulse">
            {/* Header: Name + Symbol */}
            <div style={{
                padding: '12px 10px',
                borderBottom: `2px solid ${rarityColor}66`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: `${rarityColor}11`
            }}>
                <span style={{
                    fontSize: '12px',
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: '1px'
                }}>{info.name}</span>
                <span style={{
                    fontSize: '16px',
                    color: rarityColor,
                    textShadow: `0 0 10px ${rarityColor}`
                }}>{info.symbol}</span>
            </div>

            {/* Illustration: Large Sprite */}
            <div style={{
                flex: '0 0 140px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `radial-gradient(circle, ${rarityColor}33 0%, transparent 70%)`,
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background "Circuitry" Decor */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    opacity: 0.1,
                    backgroundImage: `linear-gradient(${rarityColor} 1px, transparent 1px), linear-gradient(90deg, ${rarityColor} 1px, transparent 1px)`,
                    backgroundSize: '20px 20px'
                }} />

                <img
                    src={RARITY_IMAGES[meteorite.rarity]}
                    alt={meteorite.rarity}
                    style={{
                        width: '110px',
                        height: '110px',
                        objectFit: 'contain',
                        filter: `drop-shadow(0 0 15px ${rarityColor})`
                    }}
                />
            </div>

            {/* Stat Description Label */}
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

            {/* Stats Area */}
            <div style={{
                flex: 1,
                padding: '12px 15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
            }}>
                {meteorite.stats.coreSurge !== undefined && (
                    <div className="card-stat-line">
                        <span className="bullet">⚡</span>
                        <div className="content">
                            <span className="label">CORE SURGE</span>
                            <span className="value">+{meteorite.stats.coreSurge}% BASE POWER</span>
                        </div>
                    </div>
                )}
                {meteorite.stats.neighbor !== undefined && (
                    <div className="card-stat-line">
                        <span className="bullet">⚙</span>
                        <div className="content">
                            <span className="label">NEIGHBOR</span>
                            <span className="value">+{meteorite.stats.neighbor}% PER METEOR</span>
                        </div>
                    </div>
                )}
                {meteorite.stats.hex !== undefined && (
                    <div className="card-stat-line">
                        <span className="bullet">⌬</span>
                        <div className="content">
                            <span className="label">HEX DRIVER</span>
                            <span className="value">+{meteorite.stats.hex}% PER UPGRADE</span>
                        </div>
                    </div>
                )}
                {meteorite.stats.sameType !== undefined && (
                    <div className="card-stat-line">
                        <span className="bullet">🝔</span>
                        <div className="content">
                            <span className="label">RESONANCE</span>
                            <span className="value">+{meteorite.stats.sameType}% PER MATCH</span>
                        </div>
                    </div>
                )}
                {meteorite.stats.hexType !== undefined && (
                    <div className="card-stat-line">
                        <span className="bullet">✺</span>
                        <div className="content">
                            <span className="label">THEME MATRIX</span>
                            <span className="value">+{meteorite.stats.hexType}% PER THEME</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Rarity Label */}
            <div style={{
                padding: '6px 15px',
                fontSize: '10px',
                fontWeight: 900,
                textAlign: 'right',
                color: rarityColor,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                borderTop: `1px solid ${rarityColor}33`,
                background: 'rgba(0,0,0,0.5)'
            }}>
                {meteorite.rarity} CLASS
            </div>
        </div>
    );
};
