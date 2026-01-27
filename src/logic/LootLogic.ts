import type { GameState, Meteorite, MeteoriteRarity } from './types';
import { playSfx } from './AudioLogic';
import { calculateLegendaryBonus } from './LegendaryLogic';

const DROP_CHANCE = 0.03; // 3% (Avg 1 per 33 kills)
const MAGNET_RANGE = 200;
const PICKUP_RANGE = 20;

const RARITIES: { type: MeteoriteRarity; weight: number }[] = [
    { type: 'scrap', weight: 1 },
    { type: 'anomalous', weight: 1 },
    { type: 'quantum', weight: 1 },
    { type: 'astral', weight: 1 },
    { type: 'radiant', weight: 1 },
    { type: 'void', weight: 1 },
    { type: 'eternal', weight: 1 }
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

interface PerkDef {
    id: string;
    description: string;
    min: number;
    max: number;
}

const PERK_POOLS: Record<number, PerkDef[]> = {
    1: [
        { id: 'neighbor_any_all', description: 'Efficiency per neighboring meteorite', min: 1, max: 4 }
    ],
    2: [
        { id: 'neighbor_any_eco', description: 'Efficiency per neighboring meteorite from ECO arena', min: 2, max: 6 },
        { id: 'neighbor_any_com', description: 'Efficiency per neighboring meteorite from COM arena', min: 2, max: 6 },
        { id: 'neighbor_any_def', description: 'Efficiency per neighboring meteorite from DEF arena', min: 2, max: 6 }
    ],
    3: [
        { id: 'neighbor_new_eco', description: 'Efficiency per neighboring PRISTINE meteorite from ECO arena', min: 4, max: 10 },
        { id: 'neighbor_dam_eco', description: 'Efficiency per neighboring DAMAGED meteorite from ECO arena', min: 4, max: 10 },
        { id: 'neighbor_bro_eco', description: 'Efficiency per neighboring BROKEN meteorite from ECO arena', min: 4, max: 10 },
        { id: 'neighbor_new_com', description: 'Efficiency per neighboring PRISTINE meteorite from COM arena', min: 4, max: 10 },
        { id: 'neighbor_dam_com', description: 'Efficiency per neighboring DAMAGED meteorite from COM arena', min: 4, max: 10 },
        { id: 'neighbor_bro_com', description: 'Efficiency per neighboring BROKEN meteorite from COM arena', min: 4, max: 10 },
        { id: 'neighbor_new_def', description: 'Efficiency per neighboring PRISTINE meteorite from DEF arena', min: 4, max: 10 },
        { id: 'neighbor_dam_def', description: 'Efficiency per neighboring DAMAGED meteorite from DEF arena', min: 4, max: 10 },
        { id: 'neighbor_bro_def', description: 'Efficiency per neighboring BROKEN meteorite from DEF arena', min: 4, max: 10 }
    ],
    4: [
        { id: 'neighbor_leg_any', description: 'Efficiency per neighboring Legendary Upgrade', min: 6, max: 15 }
    ],
    5: [
        { id: 'neighbor_leg_eco', description: 'Efficiency per neighboring ECO Legendary Upgrade', min: 8, max: 20 },
        { id: 'neighbor_leg_com', description: 'Efficiency per neighboring COM Legendary Upgrade', min: 8, max: 20 },
        { id: 'neighbor_leg_def', description: 'Efficiency per neighboring DEF Legendary Upgrade', min: 8, max: 20 }
    ],
    6: [
        { id: 'pair_eco_eco', description: 'Efficiency per connecting ECO-ECO Legendary pair', min: 10, max: 25 },
        { id: 'pair_eco_com', description: 'Efficiency per connecting ECO-COM Legendary pair', min: 10, max: 25 },
        { id: 'pair_eco_def', description: 'Efficiency per connecting ECO-DEF Legendary pair', min: 10, max: 25 },
        { id: 'pair_com_com', description: 'Efficiency per connecting COM-COM Legendary pair', min: 10, max: 25 },
        { id: 'pair_com_def', description: 'Efficiency per connecting COM-DEF Legendary pair', min: 10, max: 25 },
        { id: 'pair_def_def', description: 'Efficiency per connecting DEF-DEF Legendary pair', min: 10, max: 25 }
    ],
    7: [
        { id: 'pair_eco_eco_lvl', description: 'Efficiency per connecting ECO-ECO Legendary pair of same level', min: 12, max: 30 },
        { id: 'pair_eco_com_lvl', description: 'Efficiency per connecting ECO-COM Legendary pair of same level', min: 12, max: 30 },
        { id: 'pair_eco_def_lvl', description: 'Efficiency per connecting ECO-DEF Legendary pair of same level', min: 12, max: 30 },
        { id: 'pair_com_com_lvl', description: 'Efficiency per connecting COM-COM Legendary pair of same level', min: 12, max: 30 },
        { id: 'pair_com_def_lvl', description: 'Efficiency per connecting COM-DEF Legendary pair of same level', min: 12, max: 30 },
        { id: 'pair_def_def_lvl', description: 'Efficiency per connecting DEF-DEF Legendary pair of same level', min: 12, max: 30 }
    ]
};

import { SECTOR_NAMES } from './MapLogic';

export function createMeteorite(state: GameState, rarity: MeteoriteRarity, x: number = 0, y: number = 0): Meteorite {
    const stats: Meteorite['stats'] = {};

    const qualities: import('./types').MeteoriteQuality[] = ['Broken', 'Damaged', 'New'];
    const quality = qualities[Math.floor(Math.random() * qualities.length)];

    // Mapping: Scrap=1 ... Eternal=7
    const rarityMap: Record<MeteoriteRarity, number> = {
        scrap: 1,
        anomalous: 2,
        quantum: 3,
        astral: 4,
        radiant: 5,
        void: 6,
        eternal: 7
    };
    const rarityLevel = rarityMap[rarity];
    const visualIndex = rarityLevel;

    // Quality adjustment: New +2, Damaged +0, Broken -2
    const qualityAdj = quality === 'New' ? 2 : (quality === 'Broken' ? -2 : 0);
    const rarityBonus = rarityLevel * 2;

    const perks: Meteorite['perks'] = [];
    for (let lvl = 1; lvl <= rarityLevel; lvl++) {
        const pool = PERK_POOLS[lvl];
        if (pool) {
            const def = pool[Math.floor(Math.random() * pool.length)];
            const min = def.min + rarityBonus + qualityAdj;
            const max = def.max + rarityBonus + qualityAdj;
            const value = min + Math.floor(Math.random() * (max - min + 1));
            perks.push({
                id: def.id,
                description: def.description,
                value,
                range: { min, max }
            });
        }
    }

    return {
        id: Math.random(),
        x,
        y,
        rarity,
        quality,
        visualIndex,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        magnetized: false,
        discoveredIn: SECTOR_NAMES[state.currentArena] || "UNKNOWN SECTOR",
        perks,
        stats
    };
}

export function trySpawnMeteorite(state: GameState, x: number, y: number) {
    let chance = DROP_CHANCE;
    if (state.currentArena === 0) chance *= 1.15; // +15% Drop Chance in Economic Hex

    // Add Legendary Bonus
    chance += calculateLegendaryBonus(state, 'met_drop_per_kill');

    if (Math.random() > chance) return;

    const rarity = getRandomRarity();
    const dropX = x + (Math.random() - 0.5) * 20;
    const dropY = y + (Math.random() - 0.5) * 20;

    const meteorite = createMeteorite(state, rarity, dropX, dropY);
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
        const hasSPACE = inventory.findIndex(slot => slot === null) !== -1;

        if (dist < MAGNET_RANGE && hasSPACE) {
            item.magnetized = true;
        } else if (!hasSPACE) {
            item.magnetized = false;
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
                    item.isNew = true;
                    inventory[emptySlotIndex] = item;
                    state.unseenMeteorites = (state.unseenMeteorites || 0) + 1;
                    playSfx('shoot'); // Pickup sound
                    meteorites.splice(i, 1);
                }
            }
        }
    }
}
