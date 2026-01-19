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

export function spawnParticles(state: GameState, x: number, y: number, color: string, count: number = 8) {
    if (!state.particles) state.particles = []; // Ensure array exists if not in initial state (need to add to types)

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * 6.28;
        const speed = Math.random() * 2 + 1;
        state.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
            color,
            size: Math.random() * 3 + 1
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
