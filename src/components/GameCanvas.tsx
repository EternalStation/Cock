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
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
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
