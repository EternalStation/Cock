import type { GameState, Meteorite, MeteoriteRarity } from './types';
import { playSfx } from './AudioLogic';

const DROP_CHANCE = 0.03; // 3% (Avg 1 per 33 kills)
const MAGNET_RANGE = 200;
const PICKUP_RANGE = 20;

const RARITIES: { type: MeteoriteRarity; weight: number }[] = [
    { type: 'scrap', weight: 20 },
    { type: 'anomalous', weight: 20 },
    { type: 'quantum', weight: 20 },
    { type: 'astral', weight: 20 },
    { type: 'radiant', weight: 20 }
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

export function createMeteorite(rarity: MeteoriteRarity, x: number = 0, y: number = 0): Meteorite {
    const stats: Meteorite['stats'] = {};

    // Perk 1: Core Surge (5-40%) - Available to all rarities
    stats.coreSurge = 5 + Math.floor(Math.random() * 36);

    // Perk 2: Neighbor (1-3%) - Anomalous and above
    if (['anomalous', 'quantum', 'astral', 'radiant'].includes(rarity)) {
        stats.neighbor = 1 + Math.floor(Math.random() * 3);
    }

    // Perk 3: Hex (1-50%) - Quantum and above
    if (['quantum', 'astral', 'radiant'].includes(rarity)) {
        stats.hex = 1 + Math.floor(Math.random() * 50);
    }

    // Perk 4: Same-Type (1-7%) - Astral and above
    if (['astral', 'radiant'].includes(rarity)) {
        stats.sameType = 1 + Math.floor(Math.random() * 7);
    }

    // Perk 5: Hex Type (1-10%) - Radiant only
    if (rarity === 'radiant') {
        stats.hexType = 1 + Math.floor(Math.random() * 10);
    }

    return {
        id: Math.random(),
        x,
        y,
        rarity,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        magnetized: false,
        stats
    };
}

export function trySpawnMeteorite(state: GameState, x: number, y: number) {
    if (Math.random() > DROP_CHANCE) return;

    const rarity = getRandomRarity();
    const dropX = x + (Math.random() - 0.5) * 20;
    const dropY = y + (Math.random() - 0.5) * 20;

    const meteorite = createMeteorite(rarity, dropX, dropY);
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
