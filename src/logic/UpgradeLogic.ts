import type { GameState, UpgradeChoice } from './types';
import { UPGRADE_TYPES, RARITIES, BONUSES } from './constants';
import { calcStat } from './MathUtils';

export function spawnUpgrades(state: GameState, isBoss: boolean = false): UpgradeChoice[] {
    state.isPaused = true;
    const choices: UpgradeChoice[] = [];

    if (isBoss) {
        choices.push(
            { type: { id: 'm', name: 'Dual Pulse', desc: '+1 Projectile per Shot', icon: 'special' }, rarity: { id: 'boss', label: 'Anomaly Tech', weight: 0, color: '#ef4444' }, isSpecial: true },
            { type: { id: 'p', name: 'Vortex Point', desc: '+1 Enemy Penetration', icon: 'special' }, rarity: { id: 'boss', label: 'Anomaly Tech', weight: 0, color: '#ef4444' }, isSpecial: true },
            { type: { id: 'd', name: 'Orbit Sentry', desc: state.player.droneCount < 3 ? 'Deploy Automated Drone' : '2x Damage for all Drones', icon: 'special' }, rarity: { id: 'boss', label: 'Anomaly Tech', weight: 0, color: '#ef4444' }, isSpecial: true }
        );
    } else {
        const pool = [...UPGRADE_TYPES];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            const type = pool.splice(idx, 1)[0];

            // Pick Rarity
            const r = Math.random();
            let c = 0;
            let selectedRarity = RARITIES[2]; // Default Common
            for (const rar of RARITIES) {
                c += rar.weight;
                if (r <= c) {
                    selectedRarity = rar;
                    break;
                }
            }

            choices.push({ type, rarity: selectedRarity });
        }
    }
    return choices;
}

export function applyUpgrade(state: GameState, choice: UpgradeChoice) {
    const { player } = state;

    if (choice.isSpecial) {
        if (choice.type.id === 'm') player.multi++;
        if (choice.type.id === 'p') player.pierce++;
        if (choice.type.id === 'd') {
            player.droneCount++;
            if (player.droneCount <= 3) {
                state.drones.push({ a: Math.random() * 6.28, last: 0, x: player.x, y: player.y });
            }
        }
    } else {
        const b = BONUSES[choice.rarity.id];
        const id = choice.type.id;
        const key = id.replace('_f', '').replace('_m', '');

        if (choice.type.id === 'heal') {
            player.curHp = Math.min(player.curHp + 50, calcStat(player.hp));
        } else {
            // Inline Logic Restored
            if (id === 'dmg_f') player.dmg.flat += (b[key] || b[id]);
            if (id === 'dmg_m') player.dmg.mult += (b[key] || b[id]);
            if (id === 'atk_s') player.atk.flat = Math.min(9999, player.atk.flat + (b[key] || b[id]));
            if (id === 'hp_f') { player.hp.flat += (b[key] || b[id]); player.curHp += (b[key] || b[id]); }
            if (id === 'hp_m') {
                const oldMax = calcStat(player.hp);
                player.hp.mult += (b[key] || b[id]);
                player.curHp += (calcStat(player.hp) - oldMax);
            }
            if (id === 'reg_f') player.reg.flat += (b[key] || b[id]);
            if (id === 'reg_m') player.reg.mult += (b[key] || b[id]);
            if (id === 'xp_f') player.xp_per_kill.flat += (b[key] || b[id]);
            if (id === 'arm_f') player.arm.flat += (b[key] || b[id]);
            if (id === 'arm_m') player.arm.mult += (b[key] || b[id]);

            player.upgradesCollected.push(`${choice.rarity.label} ${choice.type.name}`);
        }
    }

    state.isPaused = false;
}
