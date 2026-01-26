import type { GameState, LegendaryHex, LegendaryCategory } from './types';

export const LEGENDARY_UPGRADES: Record<LegendaryCategory, LegendaryHex[]> = {
    Economic: [
        {
            id: 'econ_hp',
            name: 'VITAL HARVEST',
            desc: '+0.5 HP per kill',
            category: 'Economic',
            type: 'hp_per_kill',
            level: 1,
            killsAtAcquisition: 0
        },
        {
            id: 'econ_ats',
            name: 'KINETIC SIPHON',
            desc: '+0.2% ATS per kill',
            category: 'Economic',
            type: 'ats_per_kill',
            level: 1,
            killsAtAcquisition: 0
        },
        {
            id: 'econ_xp',
            name: 'WISDOM SHARD',
            desc: '+0.2 XP per kill',
            category: 'Economic',
            type: 'xp_per_kill',
            level: 1,
            killsAtAcquisition: 0
        },
        {
            id: 'econ_dmg',
            name: 'POWER SURGE',
            desc: '+1 DMG per kill',
            category: 'Economic',
            type: 'dmg_per_kill',
            level: 1,
            killsAtAcquisition: 0
        },
        {
            id: 'econ_reg',
            name: 'REGEN CORE',
            desc: '+0.2 HP/sec per kill',
            category: 'Economic',
            type: 'reg_per_kill',
            level: 1,
            killsAtAcquisition: 0
        }
    ],
    Combat: [], // Future expansion
    Defensive: [] // Future expansion
};

export function getLegendaryOptions(state: GameState): LegendaryHex[] {
    const arenaIndex = state.currentArena; // 0, 1, 2
    const categories: LegendaryCategory[] = ['Economic', 'Combat', 'Defensive'];
    const category = categories[arenaIndex] || 'Economic';

    const pool = LEGENDARY_UPGRADES[category];
    if (pool.length === 0) return LEGENDARY_UPGRADES['Economic'].slice(0, 3); // Fallback

    // Shuffle and pick 3
    const options = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);

    // Check if player already has these in moduleSockets.hexagons
    // If they do, mark them as "Level Up" candidates (UI will handle this based on level)
    return options.map(opt => {
        const existing = state.moduleSockets.hexagons.find(h => h?.id === opt.id);
        if (existing) {
            return { ...opt, level: existing.level + 1, killsAtAcquisition: state.killCount };
        }
        return { ...opt, level: 1, killsAtAcquisition: state.killCount };
    });
}

export function applyLegendarySelection(state: GameState, selection: LegendaryHex) {
    state.pendingLegendaryHex = selection;
    state.showLegendarySelection = false;
    state.showModuleMenu = true;
    state.isPaused = true;
}

export function calculateLegendaryBonus(state: GameState, type: LegendaryHex['type']): number {
    let totalBonus = 0;
    state.moduleSockets.hexagons.forEach(hex => {
        if (hex && hex.type === type) {
            const killsSinceAcquisition = state.killCount - hex.killsAtAcquisition;
            const baseBonusPerKill = getBaseBonus(hex.type);
            totalBonus += killsSinceAcquisition * baseBonusPerKill * hex.level;
        }
    });
    return totalBonus;
}

function getBaseBonus(type: LegendaryHex['type']): number {
    switch (type) {
        case 'hp_per_kill': return 0.5;
        case 'ats_per_kill': return 0.2; // This is a percent in concept
        case 'xp_per_kill': return 0.2;
        case 'dmg_per_kill': return 1;
        case 'reg_per_kill': return 0.2;
        default: return 0;
    }
}
