import React, { useEffect } from 'react';
import { useGameLoop } from '../hooks/useGame';

interface GameCanvasProps {
    // We can pass props from App if needed, but hook manages most
    hook: ReturnType<typeof useGameLoop>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ hook }) => {
    const { canvasRef } = hook;

    useEffect(() => {
        const resize = () => {
            if (canvasRef.current) {
                const dpr = window.devicePixelRatio || 1;
                const width = window.innerWidth;
                const height = window.innerHeight;

                // Buffer size
                canvasRef.current.width = width * dpr;
                canvasRef.current.height = height * dpr;

                // CSS size
                canvasRef.current.style.width = `${width}px`;
                canvasRef.current.style.height = `${height}px`;

                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }
            }
        };
        window.addEventListener('resize', resize);
        resize(); // Init
        return () => window.removeEventListener('resize', resize);
    }, [canvasRef]);

    return (
        <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100vw', height: '100vh' }}
        />
    );
};
