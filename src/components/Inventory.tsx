import type { Meteorite, MeteoriteRarity } from '../logic/types';

interface InventoryProps {
    inventory: (Meteorite | null)[];
    isOpen: boolean;
    onClose: () => void;
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

export function Inventory({ inventory, isOpen, onClose }: InventoryProps) {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            color: 'white',
            fontFamily: 'Orbitron, sans-serif' // Assuming font exists or fallback
        }}>
            <h1 style={{
                marginBottom: '20px',
                fontSize: '2rem',
                textShadow: '0 0 10px #22d3ee',
                letterSpacing: '2px'
            }}>METEORITE CONTAINMENT</h1>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '12px',
                padding: '20px',
                backgroundColor: 'rgba(2, 6, 23, 0.9)',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)'
            }}>
                {inventory.map((item, index) => (
                    <InventorySlot key={index} item={item} />
                ))}
            </div>

            <div style={{ marginTop: '20px', color: '#94a3b8', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <span>Press <span style={{ color: 'white', fontWeight: 'bold' }}>I</span> to Close</span>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: 'bold'
                    }}
                >
                    CLOSE
                </button>
            </div>
        </div>
    );
}

function InventorySlot({ item }: { item: Meteorite | null }) {
    const borderColor = item ? RARITY_COLORS[item.rarity] : '#1e293b';
    const glow = item ? `0 0 15px ${borderColor}66` : 'none';

    return (
        <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#0f172a',
            border: `2px solid ${borderColor}`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: glow,
            transition: 'all 0.2s ease',
            cursor: 'pointer'
        }}
            title={item ? `${item.rarity.toUpperCase()} METEORITE` : 'Empty Slot'}
        >
            {item ? (
                <img
                    src={RARITY_IMAGES[item.rarity]}
                    alt={item.rarity}
                    style={{
                        width: '90%',
                        height: '90%',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.3))'
                    }}
                />
            ) : (
                <div style={{
                    width: '100%',
                    height: '100%',
                    opacity: 0.1,
                    backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
                    backgroundSize: '8px 8px'
                }} />
            )}

            {/* Rarity Label Tiny */}
            {item && (
                <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '0.6rem',
                    color: borderColor,
                    fontWeight: 900,
                    textShadow: '0 0 2px black'
                }}>
                    {item.rarity.toUpperCase().slice(0, 3)}
                </div>
            )}
        </div>
    );
}
