import React from 'react';
import type { Meteorite } from '../../logic/types';
import { getMeteoriteImage, RARITY_COLORS } from './ModuleUtils';

interface InventoryPanelProps {
    inventory: (Meteorite | null)[];
    movedItem: { item: any, source: string, index: number } | null;
    onInventoryUpdate: (index: number, item: any) => void;
    onSocketUpdate: (type: 'hex' | 'diamond', index: number, item: any) => void;
    setMovedItem: (item: { item: any, source: 'inventory' | 'diamond' | 'hex', index: number } | null) => void;
    handleMouseEnterItem: (item: any, x: number, y: number) => void;
    handleMouseLeaveItem: (delay?: number) => void;
    isRecycleMode: boolean; // New Prop
    onRecycleClick: (index: number) => void; // New Callback
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
    inventory,
    movedItem,
    onInventoryUpdate,
    onSocketUpdate,
    setMovedItem,
    handleMouseEnterItem,
    handleMouseLeaveItem,
    isRecycleMode,
    onRecycleClick
}) => {

    return (
        <div style={{
            flex: 1, // Fill remaining space in bottom bar
            height: '100%',
            display: 'flex', flexDirection: 'column', gap: '5px',
            paddingLeft: '0px', // REMOVED PADDING
            // borderLeft removed to avoid double line with ModuleMenu container
        }}>
            {/* Removed Title Header to make room for full-size grid */}

            <div className="inventory-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gridTemplateRows: 'repeat(6, 1fr)',     // 5x6 = 30 slots
                gap: '8px', // Uniform gap as requested
                width: '100%',
                height: '100%',
                paddingRight: '10px',
                alignItems: 'center',
                justifyItems: 'center',
                alignContent: 'center' // Vertically center the grid within container
            }}>
                {inventory.map((item, idx) => (
                    <div key={idx}
                        onClick={() => {
                            if (isRecycleMode && item) {
                                onRecycleClick(idx);
                            }
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
                            if (isRecycleMode) return; // Disable drag in recycle mode
                            if (e.button === 0 && item && !movedItem) {
                                // Drag Start logic
                                setMovedItem({ item, source: 'inventory', index: idx });
                                handleMouseLeaveItem(0); // Clear tooltip immediately
                            }
                        }}
                        onMouseUp={(e) => {
                            if (isRecycleMode) return;
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
                            width: '100%', height: 'auto',
                            maxWidth: '100%', maxHeight: '100%',
                            aspectRatio: '1/1',
                            background: '#0f172a',
                            border: isRecycleMode && item
                                ? `2px dashed #ef4444`
                                : `2px solid ${movedItem?.index === idx && movedItem.source === 'inventory' ? '#3b82f6' : (item ? RARITY_COLORS[item.rarity] : '#1e293b')}`,
                            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative',
                            cursor: isRecycleMode ? (item ? 'crosshair' : 'default') : 'pointer',
                            opacity: movedItem?.index === idx && movedItem.source === 'inventory' ? 0.3 : 1,
                            flexShrink: 0,
                            animation: isRecycleMode && item ? 'shake 0.5s infinite' : 'none',
                            transition: 'all 0.2s',
                            justifySelf: 'center', alignSelf: 'center'
                        }}>
                        {isRecycleMode && item && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(239, 68, 68, 0.2)', zIndex: 5, pointerEvents: 'none' }} />
                        )}
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
                .inventory-grid::-webkit-scrollbar { width: 6px; }
                .inventory-grid::-webkit-scrollbar-track { background: #0f172a; }
                .inventory-grid::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 3px; }
                @keyframes shake {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg); }
                    20% { transform: translate(-3px, 0px) rotate(1deg); }
                    30% { transform: translate(3px, 2px) rotate(0deg); }
                    40% { transform: translate(1px, -1px) rotate(1deg); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg); }
                    60% { transform: translate(-3px, 1px) rotate(0deg); }
                    70% { transform: translate(3px, 1px) rotate(-1deg); }
                    80% { transform: translate(-1px, -1px) rotate(1deg); }
                    90% { transform: translate(1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
            `}</style>
        </div>
    );
};
