import type { GameState } from './types';

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

export function spawnParticles(state: GameState, x: number, y: number, color: string | string[], count: number = 8, sizeOverride?: number, lifeOverride?: number) {
    if (!state.particles) state.particles = [];

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * 6.28;
        const speed = Math.random() * 2 + 1;

        let selectedColor = '';
        if (Array.isArray(color)) {
            selectedColor = color[Math.floor(Math.random() * color.length)];
        } else {
            selectedColor = color;
        }

        state.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: (lifeOverride || 30) + Math.random() * 20,
            color: selectedColor,
            size: (sizeOverride || (Math.random() * 3 + 1))
        });
    }
}

export function updateParticles(state: GameState) {
    if (!state.particles) return;

    state.particles = state.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.vx *= 0.95;
        p.vy *= 0.95;
        return p.life > 0;
    });
}
