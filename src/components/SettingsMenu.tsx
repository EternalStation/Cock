import React, { useState } from 'react';
import { setMusicVolume, setSfxVolume } from '../logic/AudioLogic';

interface SettingsMenuProps {
    onClose: () => void;
    onRestart: () => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose, onRestart }) => {
    const [musVol, setMusVol] = useState(0.5);
    const [sfxVol, setSfxVol] = useState(0.5);

    const handleMusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        setMusVol(v);
        setMusicVolume(v);
    };

    const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        setSfxVol(v);
        setSfxVolume(v);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
            <h2 style={{ color: '#fff', fontSize: 24, letterSpacing: 4, marginBottom: 40, borderBottom: '2px solid #22d3ee', paddingBottom: 10 }}>PAUSED</h2>

            <div style={{ width: '100%', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Music Volume */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>
                        <span>MUSIC VOLUME</span>
                        <span>{Math.round(musVol * 100)}%</span>
                    </div>
                    <input
                        type="range" min="0" max="1" step="0.05"
                        value={musVol} onChange={handleMusChange}
                        style={{ width: '100%', cursor: 'pointer', accentColor: '#22d3ee' }}
                    />
                </div>

                {/* SFX Volume */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>
                        <span>SFX VOLUME</span>
                        <span>{Math.round(sfxVol * 100)}%</span>
                    </div>
                    <input
                        type="range" min="0" max="1" step="0.05"
                        value={sfxVol} onChange={handleSfxChange}
                        style={{ width: '100%', cursor: 'pointer', accentColor: '#f472b6' }}
                    />
                </div>
            </div>

            <div style={{ marginTop: 40, display: 'flex', gap: 10, width: '100%', maxWidth: 300 }}>
                <button
                    onClick={onClose}
                    style={{ flex: 1, padding: '12px 0', background: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                >
                    RESUME (ESC)
                </button>
                <button
                    onClick={onRestart}
                    style={{ flex: 1, padding: '12px 0', background: '#ef4444', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 900 }}
                >
                    RESTART
                </button>
            </div>
        </div>
    );
};
