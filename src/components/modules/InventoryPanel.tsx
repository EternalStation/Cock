
import React, { useState } from 'react';
import type { Meteorite } from '../../logic/types';
import { getMeteoriteImage, RARITY_COLORS, getDustValue } from './ModuleUtils';

interface InventoryPanelProps {
    inventory: (Meteorite | null)[];
    meteoriteDust: number;
    movedItem: { item: any, source: string, index: number } | null;
    onInventoryUpdate: (index: number, item: any) => void;
    onSocketUpdate: (type: 'hex' | 'diamond', index: number, item: any) => void;
    onRecycle: (source: 'inventory' | 'diamond', index: number, amount: number) => void;
    onClose: () => void;
    setMovedItem: (item: { item: any, source: 'inventory' | 'diamond' | 'hex', index: number } | null) => void;
    handleMouseEnterItem: (item: any, x: number, y: number) => void;
    handleMouseLeaveItem: (delay?: number) => void;
    triggerPortal: () => boolean;
    portalState: string;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
    inventory,
    meteoriteDust,
    movedItem,
    onInventoryUpdate,
    onSocketUpdate,
    onRecycle,
    onClose,
    setMovedItem,
    handleMouseEnterItem,
    handleMouseLeaveItem,
    triggerPortal,
    portalState
}) => {
    const [recyclingAnim, setRecyclingAnim] = useState(false);

    return (
        <div style={{
            position: 'absolute', right: 0, top: 0, height: '100%', width: '450px',
            background: 'rgba(5, 5, 15, 0.98)', borderLeft: '4px solid #3b82f6',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
            <h2 style={{ color: '#22d3ee', margin: '0 0 5px 0', fontSize: '1.5rem', letterSpacing: '4px', textAlign: 'center' }}>INVENTORY</h2>
            <div className="inventory-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '6px',
                alignContent: 'start',
                overflowY: 'auto',
                flex: '0 1 auto',
                minHeight: 0,
                paddingRight: '5px',
                marginBottom: '10px'
            }}>
                {inventory.map((item, idx) => (
                    <div key={idx}
                        onClick={() => {
                            // No click-to-move
                        }}
                        onMouseMove={(e) => {
                            if (item && !movedItem) {
                                handleMouseEnterItem(item, e.clientX, e.clientY);
                                if (item.isNew) {
                                    item.isNew = false;
                                    onInventoryUpdate(idx, item);
                                }
                            }
                        }}
                        onMouseLeave={() => handleMouseLeaveItem(0)}
                        onMouseDown={(e) => {
                            if (e.button === 0 && item && !movedItem) {
                                // Drag Start logic
                                setMovedItem({ item, source: 'inventory', index: idx });
                                handleMouseLeaveItem(0); // Clear tooltip immediately
                            }
                        }}
                        onMouseUp={(e) => {
                            e.stopPropagation();
                            if (movedItem) {
                                // Drop Logic (Inventory Target)
                                if (movedItem.source === 'diamond') {
                                    const itemAtTarget = inventory[idx];
                                    onInventoryUpdate(idx, { ...movedItem.item });
                                    onSocketUpdate('diamond', movedItem.index, itemAtTarget);
                                } else if (movedItem.source === 'inventory') {
                                    const itemAtTarget = inventory[idx];
                                    onInventoryUpdate(idx, { ...movedItem.item });
                                    onInventoryUpdate(movedItem.index, itemAtTarget);
                                }
                                setMovedItem(null);
                            }
                        }}
                        style={{
                            width: '100%', height: '70px', background: '#0f172a',
                            border: `2px solid ${movedItem?.index === idx && movedItem.source === 'inventory' ? '#3b82f6' : (item ? RARITY_COLORS[item.rarity] : '#1e293b')}`,
                            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative',
                            cursor: 'pointer',
                            opacity: movedItem?.index === idx && movedItem.source === 'inventory' ? 0.3 : 1
                        }}>
                        {item?.isNew && (
                            <div style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                background: '#ef4444',
                                color: 'white',
                                fontSize: '8px',
                                fontWeight: 900,
                                padding: '2px 4px',
                                borderRadius: '4px',
                                boxShadow: '0 0 10px #ef4444',
                                zIndex: 10,
                                animation: 'pulse-red 1s infinite'
                            }}>
                                NEW
                            </div>
                        )}
                        {item && (
                            <img
                                src={getMeteoriteImage(item)}
                                style={{
                                    width: '80%',
                                    height: '80%',
                                    objectFit: 'contain',
                                    pointerEvents: 'none'
                                }}
                                alt="meteorite"
                            />
                        )}
                    </div>
                ))}
            </div>
            <style>{`
                .inventory-grid::-webkit-scrollbar { display: none; }
                .inventory-grid { scrollbar-width: none; -ms-overflow-style: none; }
            `}</style>

            {/* RECYCLER & PORTAL CONTROL */}
            <div style={{ marginTop: '10px', borderTop: '1px solid #3b82f6', paddingTop: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '12px', border: '1px solid #475569' }}>
                        <img src="/assets/Icons/MeteoriteDust.png" alt="Dust" style={{ width: '24px', height: '24px', marginRight: '6px' }} />
                        <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>{meteoriteDust}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>

                    {/* PORTAL BUTTON */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <button
                            onClick={() => triggerPortal()}
                            disabled={portalState !== 'closed' || meteoriteDust < 5}
                            style={{
                                width: '100%',
                                height: '60px',
                                background: portalState !== 'closed'
                                    ? 'rgba(0,0,0,0.5)'
                                    : (meteoriteDust >= 5 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
                                border: `2px solid ${portalState !== 'closed'
                                    ? '#64748b'
                                    : (meteoriteDust >= 5 ? '#4ade80' : '#ef4444')}`,
                                borderRadius: '8px',
                                color: portalState !== 'closed'
                                    ? '#94a3b8'
                                    : (meteoriteDust >= 5 ? '#ffffff' : '#ef4444'),
                                fontSize: '10px',
                                fontWeight: 900,
                                letterSpacing: '1px',
                                textTransform: 'uppercase',
                                cursor: (portalState === 'closed' && meteoriteDust >= 5) ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s',
                                boxShadow: (portalState === 'closed' && meteoriteDust >= 5) ? '0 0 10px rgba(74, 222, 128, 0.3)' : 'none'
                            }}
                            className={portalState !== 'closed' ? '' : (meteoriteDust >= 5 ? 'pulse-cyan-glow' : '')}
                        >
                            {portalState === 'closed' ? 'ACTIVATE PORTAL' : 'PORTAL ACTIVE'}
                        </button>
                        {portalState === 'closed' && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', fontSize: '10px', color: meteoriteDust >= 5 ? '#4ade80' : '#ef4444', fontWeight: 'bold' }}>
                                COST: 5 <img src="/assets/Icons/MeteoriteDust.png" alt="D" style={{ width: '12px', height: '12px' }} />
                            </div>
                        )}
                    </div>

                    {/* RECYCLER DROP ZONE */}
                    <div
                        onMouseUp={(e) => {
                            e.stopPropagation();
                            if (movedItem) {
                                const dustAmount = getDustValue(movedItem.item.rarity);
                                const source = movedItem.source === 'inventory' ? 'inventory' : (movedItem.source === 'diamond' ? 'diamond' : null);

                                if (source) {
                                    onRecycle(source, movedItem.index, dustAmount);
                                    setRecyclingAnim(true);
                                    setTimeout(() => setRecyclingAnim(false), 500);
                                    setMovedItem(null);
                                }
                            }
                        }}
                        style={{
                            flex: 1,
                            height: '60px',
                            background: recyclingAnim ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.5)',
                            border: `2px dashed ${recyclingAnim ? '#ffffff' : '#ef4444'}`,
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444',
                            fontSize: '10px',
                            letterSpacing: '2px',
                            transition: 'all 0.1s',
                            cursor: movedItem ? 'copy' : 'default',
                            transform: recyclingAnim ? 'scale(0.98)' : 'scale(1)',
                            boxShadow: recyclingAnim ? 'inset 0 0 30px #ef4444' : 'none',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        {recyclingAnim && (
                            <div style={{
                                position: 'absolute', width: '100%', height: '100%',
                                background: 'radial-gradient(circle, transparent 20%, #ef4444 100%)',
                                animation: 'pulse-crimson 0.2s infinite'
                            }} />
                        )}
                        {recyclingAnim ? (
                            <span style={{ color: '#fff', fontWeight: '900', fontSize: '12px', textShadow: '0 0 10px #ef4444' }}>DESTROYING...</span>
                        ) : (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold' }}>RECYCLER</div>
                                <div style={{ fontSize: '8px', opacity: 0.8 }}>DROP HERE</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <button onClick={onClose} style={{
                background: '#3b82f6',
                border: 'none',
                color: 'white',
                padding: '12px 20px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '5px',
                width: '100%',
                letterSpacing: '2px',
                transition: 'background 0.2s'
            }}>CLOSE (X)</button>
        </div>
    );
};
