import type { GameState, LegendaryHex } from './types';

export const LEGENDARY_UPGRADES: Record<string, LegendaryHex> = {
    EcoDMG: {
        id: 'eco_dmg',
        name: 'STORM OF STEEL',
        desc: '+1 DMG per kill',
        category: 'Economic',
        type: 'EcoDMG',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/EcoDMG.png'
    },
    EcoXP: {
        id: 'eco_xp',
        name: 'NEURAL HARVEST',
        desc: '+1 XP per kill',
        category: 'Economic',
        type: 'EcoXP',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/EcoXP.png'
    },
    EcoHP: {
        id: 'eco_hp',
        name: 'ESSENCE SYPHON',
        desc: '+1 Max HP per kill',
        category: 'Economic',
        type: 'EcoHP',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/EcoHP.png'
    }
};

export function getLegendaryPerksArray(type: string, level: number): string[] {
    const perks: Record<string, string[]> = {
        EcoDMG: [
            "+1 DMG per kill",
            "+1 DMG% per kill",
            "+1 ATS per kill",
            "+1 ATS% per kill",
            "Mergeable"
        ],
        EcoXP: [
            "+1 XP per kill",
            "+1% Meteorite drop per kill",
            "+1 XP% per kill",
            "+1% Upgrade Rarity per kill",
            "Mergeable"
        ],
        EcoHP: [
            "+1 Max HP per kill",
            "+1 HP/sec per kill",
            "+1 Max HP% per kill",
            "+1 HP/sec% per kill",
            "Mergeable"
        ]
    };
    const list = perks[type];
    if (!list) return [];

    return list.slice(0, level);
}

export function getLegendaryPerkDesc(type: string, level: number): string {
    const list = getLegendaryPerksArray(type, level);
    return list.join("\n");
}

export function getLegendaryOptions(state: GameState): LegendaryHex[] {
    const ecoTypes: (keyof typeof LEGENDARY_UPGRADES)[] = ['EcoDMG', 'EcoXP', 'EcoHP'];

    return ecoTypes.map(typeKey => {
        const base = LEGENDARY_UPGRADES[typeKey];
        const existing = state.moduleSockets.hexagons.find(h => h?.type === base.type);

        const level = existing ? Math.min(5, existing.level + 1) : 1;
        const killsAtAcquisition = existing ? existing.killsAtAcquisition : state.killCount;

        return {
            ...base,
            level,
            killsAtAcquisition,
            desc: getLegendaryPerkDesc(base.type, level),
            perks: getLegendaryPerksArray(base.type, level)
        };
    });
}

export function syncLegendaryHex(hex: LegendaryHex) {
    hex.desc = getLegendaryPerkDesc(hex.type, hex.level);
    hex.perks = getLegendaryPerksArray(hex.type, hex.level);
}

export function applyLegendarySelection(state: GameState, selection: LegendaryHex) {
    // Check if we already have this hex type
    const existingIdx = state.moduleSockets.hexagons.findIndex(h => h?.type === selection.type);

    if (existingIdx !== -1) {
        // Just update the level of the existing one
        const existing = state.moduleSockets.hexagons[existingIdx]!;
        existing.level = selection.level;
        syncLegendaryHex(existing);
        // Keep the original killsAtAcquisition to maintain the per-kill bonus history
        state.pendingLegendaryHex = null; // No need to place it
        state.showLegendarySelection = false;
        state.isPaused = false;
    } else {
        syncLegendaryHex(selection);
        state.pendingLegendaryHex = selection;
        state.showLegendarySelection = false;
        state.showModuleMenu = true;
        state.isPaused = true;
    }
}

import { calculateMeteoriteEfficiency } from './EfficiencyLogic';

export function calculateLegendaryBonus(state: GameState, statKey: string): number {
    let total = 0;
    state.moduleSockets.hexagons.forEach((hex, hexIdx) => {
        if (!hex) return;
        const kills = state.killCount - hex.killsAtAcquisition;
        if (kills <= 0) return;

        // Calculate efficiency multiplier from connected meteorites
        // Hex i connects to Diamonds: i, (i+5)%6, i+6, ((i+5)%6)+6
        const connectedDiamondIdxs = [
            hexIdx,
            (hexIdx + 5) % 6,
            hexIdx + 6,
            ((hexIdx + 5) % 6) + 6
        ];

        let hexEfficiency = 0;
        connectedDiamondIdxs.forEach(dIdx => {
            const result = calculateMeteoriteEfficiency(state, dIdx);
            hexEfficiency += result.totalBoost;
        });

        const multiplier = 1 + hexEfficiency;

        if (hex.type === 'EcoDMG') {
            if (statKey === 'dmg_per_kill' && hex.level >= 1) total += kills * 1 * multiplier;
            if (statKey === 'dmg_pct_per_kill' && hex.level >= 2) total += kills * 1 * multiplier;
            if (statKey === 'ats_per_kill' && hex.level >= 3) total += kills * 1 * multiplier;
            if (statKey === 'ats_pct_per_kill' && hex.level >= 4) total += kills * 1 * multiplier;
        }
        if (hex.type === 'EcoXP') {
            if (statKey === 'xp_per_kill' && hex.level >= 1) total += kills * 1 * multiplier;
            if (statKey === 'met_drop_per_kill' && hex.level >= 2) total += kills * 0.01 * multiplier;
            if (statKey === 'xp_pct_per_kill' && hex.level >= 3) total += kills * 1 * multiplier;
            if (statKey === 'rarity_boost_per_kill' && hex.level >= 4) total += kills * 0.01 * multiplier;
        }
        if (hex.type === 'EcoHP') {
            if (statKey === 'hp_per_kill' && hex.level >= 1) total += kills * 1 * multiplier;
            if (statKey === 'reg_per_kill' && hex.level >= 2) total += kills * 1 * multiplier;
            if (statKey === 'hp_pct_per_kill' && hex.level >= 3) total += kills * 1 * multiplier;
            if (statKey === 'reg_pct_per_kill' && hex.level >= 4) total += kills * 1 * multiplier;
        }
    });
    return total;
}

