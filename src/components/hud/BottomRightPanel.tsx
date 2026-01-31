
import React from 'react';

interface BottomRightPanelProps {
    onInventoryToggle: () => void;
    unseenMeteorites: number;
    fps: number;
}

export const BottomRightPanel: React.FC<BottomRightPanelProps> = ({ onInventoryToggle, unseenMeteorites, fps }) => {
    return (
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
                {unseenMeteorites > 0 && (
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
                        {unseenMeteorites}
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
    );
};
