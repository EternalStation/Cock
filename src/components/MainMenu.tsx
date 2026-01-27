import React, { useEffect, useState } from 'react';
import { startMenuMusic } from '../logic/AudioLogic';

interface MainMenuProps {
    onStart: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
    const [fading, setFading] = useState(false);
    const [showBlueprint, setShowBlueprint] = useState(false);

    // Start Menu Music on mount
    useEffect(() => {
        startMenuMusic();
    }, []);

    // Handle ESC key to close blueprint
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && showBlueprint) {
                setShowBlueprint(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showBlueprint]);

    const handleStart = () => {
        setFading(true);
        setTimeout(() => {
            onStart();
        }, 1000); // 1s fade out
    };

    // Dark Ominous Hexagon Theme (Clean & Fearful)
    useEffect(() => {
        const canvas = document.getElementById('menu-particles') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        const handleResize = () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        class DarkHex {
            x: number;
            y: number;
            size: number;
            speedX: number;
            speedY: number;
            opacity: number;
            growing: boolean;

            constructor() {
                this.x = Math.random() * w;
                this.y = Math.random() * h;
                this.size = Math.random() * 40 + 10; // Medium sizes
                this.speedX = (Math.random() - 0.5) * 0.2; // Very slow, ominous drifting
                this.speedY = (Math.random() - 0.5) * 0.2;
                this.opacity = Math.random() * 0.1 + 0.02; // Very faint
                this.growing = Math.random() > 0.5;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                // Subtle pulsing
                if (this.growing) {
                    this.opacity += 0.0005;
                    if (this.opacity > 0.15) this.growing = false;
                } else {
                    this.opacity -= 0.0005;
                    if (this.opacity < 0.02) this.growing = true;
                }

                // Wrap smoothly
                if (this.x > w + 50) this.x = -50;
                if (this.x < -50) this.x = w + 50;
                if (this.y > h + 50) this.y = -50;
                if (this.y < -50) this.y = h + 50;
            }

            draw(context: CanvasRenderingContext2D) {
                context.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = 2 * Math.PI / 6 * i;
                    context.lineTo(this.x + this.size * Math.cos(angle), this.y + this.size * Math.sin(angle));
                }
                context.closePath();
                context.fillStyle = `rgba(100, 116, 139, ${this.opacity})`; // Dark Slate/Grey
                context.fill();
                context.strokeStyle = `rgba(255, 255, 255, ${this.opacity * 0.5})`; // Faint faint outline
                context.lineWidth = 1;
                context.stroke();
            }
        }

        const hexes: DarkHex[] = [];
        // Reduced count for cleaner look
        for (let i = 0; i < 25; i++) {
            hexes.push(new DarkHex());
        }

        let animId: number;
        const loop = () => {
            // Strict clear for clean look
            ctx.clearRect(0, 0, w, h);

            // Background Gradient (Vignette)
            const grad = ctx.createRadialGradient(w / 2, h / 2, h / 3, w / 2, h / 2, h);
            grad.addColorStop(0, '#0f172a'); // Slate 900
            grad.addColorStop(1, '#020617'); // Slate 950 (Almost black)
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            hexes.forEach(hex => {
                hex.update();
                hex.draw(ctx);
            });

            animId = requestAnimationFrame(loop);
        };
        loop();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="main-menu" style={{ transition: 'opacity 1s', opacity: fading ? 0 : 1 }}>
            <canvas id="menu-particles" style={{ position: 'absolute', top: 0, left: 0 }} />

            <div className="menu-container">
                <div className="menu-title">NEON SURVIVOR</div>

                <button className="btn-start" onClick={handleStart}>START</button>
                <button className="btn-logic" onClick={() => setShowBlueprint(true)}>GAME LOGIC</button>

                {showBlueprint && (
                    <div className="blueprint-modal" onClick={() => setShowBlueprint(false)}>
                        <div className="blueprint-container" onClick={(e) => e.stopPropagation()}>
                            <div className="blueprint-header">
                                <div className="blueprint-title">NEON SURVIVOR - BLUEPRINT & LOGIC</div>
                                <button className="btn-close-blueprint" onClick={() => setShowBlueprint(false)}>CLOSE [ESC]</button>
                            </div>
                            <iframe
                                src="/blueprint.html"
                                className="blueprint-iframe"
                                title="Game Blueprint"
                            />
                        </div>
                    </div>
                )}

                <div className="controls-hint-container">
                    {/* WASD - Movement & Scroll */}
                    <div className="control-group">
                        <div className="keys-visual">
                            <div className="key-group">
                                <div className="key-row">
                                    <div className="key-box">W</div>
                                </div>
                                <div className="key-row">
                                    <div className="key-box">A</div>
                                    <div className="key-box">S</div>
                                    <div className="key-box">D</div>
                                </div>
                            </div>
                        </div>
                        <span className="control-label">MOVE / SCROLL</span>
                    </div>

                    {/* SPACE - Select */}
                    <div className="control-group">
                        <div className="keys-visual">
                            <div className="key-box space-key" style={{ width: 120 }}>SPACE</div>
                        </div>
                        <span className="control-label">SELECT UPGRADE</span>
                    </div>

                    {/* C - Data */}
                    <div className="control-group">
                        <div className="keys-visual">
                            <div className="key-box">C</div>
                        </div>
                        <span className="control-label">DATA</span>
                    </div>


                    {/* X - Matrix */}
                    <div className="control-group">
                        <div className="keys-visual">
                            <div className="key-box">X</div>
                        </div>
                        <span className="control-label">MATRIX</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
