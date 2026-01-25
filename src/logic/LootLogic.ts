import type { GameState, Meteorite, MeteoriteRarity } from './types';
import { playSfx } from './AudioLogic';

const DROP_CHANCE = 0.10; // 10%
const MAGNET_RANGE = 200;
const PICKUP_RANGE = 20;

const RARITIES: { type: MeteoriteRarity; weight: number }[] = [
    { type: 'scrap', weight: 40 },
    { type: 'anomalous', weight: 30 },
    { type: 'quantum', weight: 15 },
    { type: 'astral', weight: 10 },
    { type: 'radiant', weight: 5 }
];

function getRandomRarity(): MeteoriteRarity {
    const totalWeight = RARITIES.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;

    for (const r of RARITIES) {
        if (random < r.weight) return r.type;
        random -= r.weight;
    }
    return 'scrap';
}

export function trySpawnMeteorite(state: GameState, x: number, y: number) {
    if (Math.random() > DROP_CHANCE) return;

    const rarity = getRandomRarity();

    // Spread drop slightly
    const dropX = x + (Math.random() - 0.5) * 20;
    const dropY = y + (Math.random() - 0.5) * 20;

    const meteorite: Meteorite = {
        id: Math.random(),
        x: dropX,
        y: dropY,
        rarity,
        vx: (Math.random() - 0.5) * 2, // Initial scattering bounce
        vy: (Math.random() - 0.5) * 2,
        magnetized: false
    };

    state.meteorites.push(meteorite);
}

export function updateLoot(state: GameState) {
    const { meteorites, player, inventory } = state;

    for (let i = meteorites.length - 1; i >= 0; i--) {
        const item = meteorites[i];

        // Friction / Deceleration for initial bounce
        item.x += item.vx;
        item.y += item.vy;
        item.vx *= 0.95;
        item.vy *= 0.95;

        const dx = player.x - item.x;
        const dy = player.y - item.y;
        const dist = Math.hypot(dx, dy);

        // Magnet Logic
        if (dist < MAGNET_RANGE) {
            item.magnetized = true;
        }

        if (item.magnetized) {
            // Accelerate towards player
            const speed = 12; // Fast magnetic pull
            const angle = Math.atan2(dy, dx);
            item.x += Math.cos(angle) * speed;
            item.y += Math.sin(angle) * speed;

            // Pickup Logic
            if (dist < PICKUP_RANGE) {
                // Try to add to inventory
                const emptySlotIndex = inventory.findIndex(slot => slot === null);

                if (emptySlotIndex !== -1) {
                    // Add to inventory
                    inventory[emptySlotIndex] = item;
                    playSfx('shoot'); // Pickup sound
                    meteorites.splice(i, 1);
                }
            }
        }
    }
}
