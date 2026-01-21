import type { Rarity, Upgrade } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const RARITIES: Rarity[] = [
    { id: 'junk', label: 'Junk', weight: 0.1, color: '#475569' },
    { id: 'broken', label: 'Broken', weight: 0.1, color: '#78350f' },
    { id: 'common', label: 'Common', weight: 0.1, color: '#94a3b8' },
    { id: 'uncommon', label: 'Uncommon', weight: 0.1, color: '#22c55e' },
    { id: 'rare', label: 'Rare', weight: 0.1, color: '#3b82f6' },
    { id: 'epic', label: 'Epic', weight: 0.1, color: '#ec4899' },
    { id: 'legendary', label: 'Legendary', weight: 0.1, color: '#f59e0b' },
    { id: 'mythical', label: 'Mythical', weight: 0.1, color: '#a855f7' },
    { id: 'ancient', label: 'Ancient', weight: 0.1, color: '#facc15' },
    { id: 'divine', label: 'Divine', weight: 0.1, color: '#22d3ee' }
];

export const UPGRADE_TYPES: Upgrade[] = [
    { id: 'dmg_f', name: 'Additional Damage', desc: 'Increases base power.', icon: 'dmg' },
    { id: 'dmg_m', name: 'Damage Multiplier', desc: 'Boosts total power %.', icon: 'zap' },
    { id: 'atk_s', name: 'Attack Speed', desc: 'Reduces firing delay.', icon: 'atk' },
    { id: 'hp_f', name: 'Max Health', desc: 'Increases HP capacity.', icon: 'hp' },
    { id: 'hp_m', name: 'Health Multiplier', desc: 'Boosts HP capacity %.', icon: 'hp' },
    { id: 'reg_f', name: 'Health Regen', desc: 'Flat HP/sec.', icon: 'reg' },
    { id: 'reg_m', name: 'Regen Multiplier', desc: 'Boosts regen %.', icon: 'reg' },
    { id: 'xp_f', name: 'Exp Per Kill', desc: 'Flat XP bonus.', icon: 'xp' },
    { id: 'arm_f', name: 'Defense (Armor)', desc: 'Flat reduction.', icon: 'arm' },
    { id: 'arm_m', name: 'Defense Multiplier', desc: 'Boosts armor %.', icon: 'arm' }
];

export const BONUSES: Record<string, Record<string, number>> = {
    junk: { dmg_f: 1, dmg_m: 1, atk_s: 1, hp_f: 10, hp_m: 1, reg_f: 1, reg_m: 1, xp_f: 1, arm_f: 10, arm_m: 1 },
    broken: { dmg_f: 3, dmg_m: 3, atk_s: 5, hp_f: 20, hp_m: 2, reg_f: 2, reg_m: 2, xp_f: 2, arm_f: 20, arm_m: 2 },
    common: { dmg_f: 7, dmg_m: 7, atk_s: 10, hp_f: 30, hp_m: 3, reg_f: 3, reg_m: 3, xp_f: 3, arm_f: 30, arm_m: 3 },
    uncommon: { dmg_f: 15, dmg_m: 10, atk_s: 15, hp_f: 40, hp_m: 4, reg_f: 4, reg_m: 4, xp_f: 4, arm_f: 40, arm_m: 4 },
    rare: { dmg_f: 25, dmg_m: 15, atk_s: 25, hp_f: 50, hp_m: 5, reg_f: 5, reg_m: 5, xp_f: 5, arm_f: 50, arm_m: 5 },
    epic: { dmg_f: 55, dmg_m: 25, atk_s: 50, hp_f: 90, hp_m: 7, reg_f: 7, reg_m: 7, xp_f: 7, arm_f: 90, arm_m: 12 },
    legendary: { dmg_f: 70, dmg_m: 30, atk_s: 60, hp_f: 120, hp_m: 8, reg_f: 8, reg_m: 8, xp_f: 8, arm_f: 100, arm_m: 15 },
    mythical: { dmg_f: 40, dmg_m: 20, atk_s: 35, hp_f: 70, hp_m: 6, reg_f: 6, reg_m: 6, xp_f: 6, arm_f: 70, arm_m: 9 },
    ancient: { dmg_f: 90, dmg_m: 40, atk_s: 80, hp_f: 170, hp_m: 10, reg_f: 10, reg_m: 10, xp_f: 10, arm_f: 120, arm_m: 15 },
    divine: { dmg_f: 150, dmg_m: 80, atk_s: 125, hp_f: 300, hp_m: 20, reg_f: 20, reg_m: 20, xp_f: 20, arm_f: 250, arm_m: 25 }
};

// --- Enemy Progression Constants ---

export const SHAPE_CYCLE_ORDER = ['circle', 'triangle', 'square', 'diamond', 'pentagon'];

export const SHAPE_DEFS: Record<string, { type: string; hpMult: number; speedMult: number; sizeMult: number; spawnWeight: number }> = {
    circle: { type: 'circle', hpMult: 1, speedMult: 1, sizeMult: 1, spawnWeight: 1.5 },
    triangle: { type: 'triangle', hpMult: 0.8, speedMult: 1.3, sizeMult: 0.9, spawnWeight: 1.2 },
    square: { type: 'square', hpMult: 2.5, speedMult: 0.6, sizeMult: 1.2, spawnWeight: 0.8 },
    diamond: { type: 'diamond', hpMult: 0.6, speedMult: 1.5, sizeMult: 0.8, spawnWeight: 1.0 },
    pentagon: { type: 'pentagon', hpMult: 4.0, speedMult: 0.8, sizeMult: 1.5, spawnWeight: 0.3 }
};

// Core, Medium, Dark (for Cycle Logic)
export const PALETTES = [
    { name: 'Neon Green', colors: ['#00FF00', '#408040', '#204020'] },
    { name: 'Cyber Blue', colors: ['#00FFFF', '#206080', '#103040'] }, // Cyan Main
    { name: 'Void Purple', colors: ['#BF00FF', '#602080', '#301040'] }, // Electric Purple
    { name: 'Solar Orange', colors: ['#FF9900', '#805020', '#402510'] }, // Deep Orange
    { name: 'Crimson Red', colors: ['#FF0000', '#802020', '#401010'] }  // Pure Red
];

export const PULSE_RATES = [
    { time: 5, interval: 300 },   // 0-5 mins: Slow Pulse
    { time: 10, interval: 180 },  // 5-10 mins: Medium Pulse
    { time: 15, interval: 120 },  // 10-15 mins: Fast Pulse
    { time: 999, interval: 60 }   // 15+ mins: Hyper Pulse
];

