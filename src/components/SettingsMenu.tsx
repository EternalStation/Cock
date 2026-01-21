import React, { useState } from 'react';
import { setMusicVolume, setSfxVolume, getMusicVolume, getSfxVolume } from '../logic/AudioLogic';

interface SettingsMenuProps {
    onClose: () => void;
    onRestart: () => void;
    onQuit: () => void;
}

export const SettingsMenu = ({ onClose, onRestart, onQuit }: SettingsMenuProps) => {
    const [musVol, setMusVol] = useState(getMusicVolume());
    const [sfxVol, setSfxVol] = useState(getSfxVolume());

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
        <div className="modal-overlay overlay-blur" style={{ zIndex: 100 }}>
            <h2 style={{ color: '#fff', fontSize: 24, letterSpacing: 4, marginBottom: 40, borderBottom: '2px solid #22d3ee', paddingBottom: 10, textShadow: '0 0 10px #22d3ee' }}>PAUSED</h2>

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

            <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>

                <button
                    onClick={onClose}
                    style={{ padding: '15px 0', background: '#22d3ee', border: 'none', color: '#000', borderRadius: 6, cursor: 'pointer', fontWeight: 900, marginBottom: 10 }}
                >
                    RESUME
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={onRestart}
                        style={{ flex: 1, padding: '15px 0', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 6, cursor: 'pointer', fontWeight: 900 }}
                    >
                        RESTART
                    </button>
                    <button
                        onClick={onQuit}
                        style={{ flex: 1, padding: '15px 0', background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                    >
                        QUIT
                    </button>
                </div>
            </div>
        </div>
    );
};
