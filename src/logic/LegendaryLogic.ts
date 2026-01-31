import type { GameState, LegendaryHex, LegendaryType } from './types';

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
    },
    ComLife: {
        id: 'com_life',
        name: 'CRIMSON FEAST',
        desc: '+15% Lifesteal',
        category: 'Combat',
        type: 'ComLife',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/ComLife.png'
    },
    ComCrit: {
        id: 'com_crit',
        name: 'SHATTERED FATE',
        desc: '+15% Crit Chance',
        category: 'Combat',
        type: 'ComCrit',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/ComCrit.png'
    },
    ComWave: {
        id: 'com_wave',
        name: 'TERROR PULSE',
        desc: 'Sonic Wave on every 15th shot',
        category: 'Combat',
        type: 'ComWave',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/ComWave.png'
    },
    DefPuddle: {
        id: 'def_puddle',
        name: 'TOXIC SWAMP',
        desc: 'Active: Spawn Toxic Puddle',
        category: 'Defensive',
        type: 'DefPuddle',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/DefPuddle.png'
    },
    DefEpi: {
        id: 'def_epi',
        name: 'EPICENTER',
        desc: 'Active: Channel Spikes',
        category: 'Defensive',
        type: 'DefEpi',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/DefEpi.png'
    },
    CombShield: {
        id: 'comb_shield',
        name: 'AEGIS PROTOCOL',
        desc: 'Scaling Defense per Kill',
        category: 'Defensive',
        type: 'CombShield',
        level: 1,
        killsAtAcquisition: 0,
        customIcon: '/assets/hexes/DefShield.png'
    }
};

export function getLegendaryPerksArray(type: string, level: number): string[] {
    const perks: Record<string, string[]> = {
        EcoDMG: [
            "+0.2 DMG per kill",
            "+0.2 ATS per kill",
            "+0.2 DMG% per kill",
            "+0.2 ATS% per kill",
            "MAX LEVEL (Mergeable)"
        ],
        EcoXP: [
            "+0.2 XP per kill",
            "+0.2% Meteor Drop per kill",
            "+0.2% Rarity Boost per kill",
            "+0.2 XP% per kill",
            "MAX LEVEL (Mergeable)"
        ],
        EcoHP: [
            "+0.2 Max HP per kill",
            "+0.2 HP/sec per kill",
            "+0.2 Max HP% per kill",
            "+0.2 HP/sec% per kill",
            "MAX LEVEL (Mergeable)"
        ],
        ComLife: [
            "+15% Lifesteal",
            "Overheal -> Shield (200% eff, 3s)",
            "Attacks: Deal 2% Enemy Max HP",
            "Necromancy: 10% Chance for Zombie",
            "MAX LEVEL (Mergeable)"
        ],
        ComCrit: [
            "+15% Crit Chance (2x DMG)",
            "Execute: 10% Chance if HP < 50%",
            "Death Mark: Target takes 300% DMG",
            "Crit Upgrade: 25% Chance (3.5x DMG)",
            "MAX LEVEL (Mergeable)"
        ],
        ComWave: [
            "Every 15 shots: Sonic Wave (75% DMG, 450 Range)",
            "Wave adds Fear (1.5s)",
            "Wave Upgrade: 125% DMG, 600 Range",
            "Twin Wave (Front & Back)",
            "MAX LEVEL (Mergeable)"
        ],
        DefPuddle: [
            "Active (25s CD): 500px Puddle, Slow 20%, Dmg Taken +20%",
            "Acid: Enemies take 5% Max HP/sec inside",
            "Synthesis: +25% Max HP & Regen while standing in puddle",
            "Expansion: 600px Radius, Slow 30%, Dmg Taken +30%",
            "MAX LEVEL (Mergeable)"
        ],
        DefEpi: [
            "Active (30s CD): Channel Spikes (70% Slow, 25% Dmg/0.5s)",
            "Fortress: -50% Dmg Taken channeling",
            "Stasis: Invulnerable Shield for first 3s",
            "Cataclysm: 80% Slow, 35% Dmg/0.5s",
            "MAX LEVEL (Mergeable)"
        ],
        CombShield: [
            "+1 Armor per kill",
            "+1% Collision Dmg Red. per kill",
            "+1% Projectile Dmg Red. per kill",
            "+1% Armor Multiplier per kill",
            "MAX LEVEL (Mergeable)"
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
    let pool: (keyof typeof LEGENDARY_UPGRADES)[] = ['EcoDMG', 'EcoXP', 'EcoHP'];

    // Arena 1 is Combat Hex
    if (state.currentArena === 1) {
        pool = ['ComLife', 'ComCrit', 'ComWave'];
    }

    // Arena 2 is Defense Hex (Assuming Arena 2 is where they drop)
    // Or if currentArena is vague, we might add them to pool if specific condition met?
    // User said "drop from bosses in defenece arena". I'll assume Arena 2 or 3.
    // Let's assume Arena 2.
    if (state.currentArena === 2) {
        pool = ['DefPuddle', 'DefEpi', 'CombShield'];
    }

    return pool.map(typeKey => {
        const base = LEGENDARY_UPGRADES[typeKey];
        const existing = state.moduleSockets.hexagons.find(h => h?.type === base.type);

        const level = existing ? Math.min(5, existing.level + 1) : 1;
        const killsAtAcquisition = existing ? existing.killsAtAcquisition : state.killCount;

        // Pass existing killsAtLevel or create new one
        const killsAtLevel = existing ? { ...existing.killsAtLevel } : {};
        if (!killsAtLevel[level]) {
            killsAtLevel[level] = state.killCount;
        }

        return {
            ...base,
            level,
            killsAtAcquisition,
            killsAtLevel,
            desc: getLegendaryPerkDesc(base.type, level),
            perks: getLegendaryPerksArray(base.type, level)
        };
    });
}

export function syncLegendaryHex(hex: LegendaryHex) {
    hex.desc = getLegendaryPerkDesc(hex.type, hex.level);
    hex.perks = getLegendaryPerksArray(hex.type, hex.level);
}

const ACTIVE_LEGENDARIES: string[] = ['DefPuddle', 'DefEpi'];

export function applyLegendarySelection(state: GameState, selection: LegendaryHex) {
    // Check if we already have this hex type
    const existingIdx = state.moduleSockets.hexagons.findIndex(h => h?.type === selection.type);

    if (existingIdx !== -1) {
        // Just update the level of the existing one
        const existing = state.moduleSockets.hexagons[existingIdx]!;
        existing.level = selection.level;

        // Initialize killsAtLevel if missing
        if (!existing.killsAtLevel) existing.killsAtLevel = {};
        // Record starting killCount for this NEW level
        existing.killsAtLevel[existing.level] = state.killCount;

        syncLegendaryHex(existing); // This ensures `perks`/`desc` are updated for the new level
        state.pendingLegendaryHex = null;
        state.showLegendarySelection = false;
        state.isPaused = false;
    } else {
        // Initial Acquisition
        if (!selection.killsAtLevel) selection.killsAtLevel = {};
        selection.killsAtLevel[1] = state.killCount;

        syncLegendaryHex(selection);
        state.pendingLegendaryHex = selection;
        state.showLegendarySelection = false;
        state.showModuleMenu = true;
        state.isPaused = true;

        // Handle Active Skills
        if (ACTIVE_LEGENDARIES.includes(selection.type)) {
            // Check if already in active skills (shouldn't be for new acquisition, but safety check)
            const hasSkill = state.player.activeSkills.some(s => s.type === selection.type);
            if (!hasSkill) {
                const usedKeys = state.player.activeSkills.map(s => s.keyBind);
                const availableKeys = ['1', '2', '3', '4', '5'];
                const key = availableKeys.find(k => !usedKeys.includes(k));

                if (key) {
                    state.player.activeSkills.push({
                        type: selection.type,
                        cooldownMax: selection.type === 'DefPuddle' ? 25000 : 30000, // 25s for Puddle, 30s for Epi
                        cooldown: 0,
                        inUse: false,
                        keyBind: key,
                        icon: selection.customIcon
                    });
                }
            }
        }
    }
}

import { calculateMeteoriteEfficiency } from './EfficiencyLogic';

export function getHexLevel(state: GameState, type: LegendaryType): number {
    const hex = state.moduleSockets.hexagons.find(h => h?.type === type);
    return hex ? hex.level : 0;
}

export function getHexMultiplier(state: GameState, type: LegendaryType): number {
    const hexIdx = state.moduleSockets.hexagons.findIndex(h => h?.type === type);
    if (hexIdx === -1) return 1.0;

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

    return 1 + hexEfficiency;
}

export function calculateLegendaryBonus(state: GameState, statKey: string): number {
    let total = 0;
    state.moduleSockets.hexagons.forEach((hex) => {
        if (!hex) return;

        const multiplier = getHexMultiplier(state, hex.type);
        const kl = hex.killsAtLevel || { [1]: hex.killsAtAcquisition };

        const getKillsSinceLevel = (lvl: number) => {
            const startKills = kl[lvl] ?? state.killCount;
            return Math.max(0, state.killCount - startKills);
        };

        if (hex.type === 'EcoDMG') {
            if (statKey === 'dmg_per_kill' && hex.level >= 1) total += getKillsSinceLevel(1) * 0.2 * multiplier;
            if (statKey === 'ats_per_kill' && hex.level >= 2) total += getKillsSinceLevel(2) * 0.2 * multiplier;
            if (statKey === 'dmg_pct_per_kill' && hex.level >= 3) total += getKillsSinceLevel(3) * 0.2 * multiplier;
            if (statKey === 'ats_pct_per_kill' && hex.level >= 4) total += getKillsSinceLevel(4) * 0.2 * multiplier;
        }
        if (hex.type === 'EcoXP') {
            if (statKey === 'xp_per_kill' && hex.level >= 1) total += getKillsSinceLevel(1) * 0.2 * multiplier;
            if (statKey === 'met_drop_per_kill' && hex.level >= 2) total += getKillsSinceLevel(2) * 0.002 * multiplier;
            if (statKey === 'rarity_boost_per_kill' && hex.level >= 3) total += getKillsSinceLevel(3) * 0.002 * multiplier;
            if (statKey === 'xp_pct_per_kill' && hex.level >= 4) total += getKillsSinceLevel(4) * 0.2 * multiplier;
        }
        if (hex.type === 'EcoHP') {
            if (statKey === 'hp_per_kill' && hex.level >= 1) total += getKillsSinceLevel(1) * 0.2 * multiplier;
            if (statKey === 'reg_per_kill' && hex.level >= 2) total += getKillsSinceLevel(2) * 0.1 * multiplier;
            if (statKey === 'hp_pct_per_kill' && hex.level >= 3) total += getKillsSinceLevel(3) * 0.2 * multiplier;
            if (statKey === 'reg_pct_per_kill' && hex.level >= 4) total += getKillsSinceLevel(4) * 0.2 * multiplier;
        }

        // CombShield Logic
        if (hex.type === 'CombShield') {
            if (statKey === 'arm_per_kill' && hex.level >= 1) total += getKillsSinceLevel(1) * 1 * multiplier;
            if (statKey === 'col_red_per_kill' && hex.level >= 2) total += getKillsSinceLevel(2) * 0.01 * multiplier;
            if (statKey === 'proj_red_per_kill' && hex.level >= 3) total += getKillsSinceLevel(3) * 0.01 * multiplier;
            if (statKey === 'arm_pct_per_kill' && hex.level >= 4) total += getKillsSinceLevel(4) * 0.01 * multiplier;
        }

        // ComLife Logic
        if (hex.type === 'ComLife') {
            if (statKey === 'lifesteal' && hex.level >= 1) total += 15 * multiplier;
        }
    });
    return total;
}

