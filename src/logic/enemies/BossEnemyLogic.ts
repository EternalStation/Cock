import type { Enemy, GameState } from '../types';
import { spawnParticles, spawnFloatingNumber } from '../ParticleLogic';
import { playSfx } from '../AudioLogic';
import { calcStat, getDefenseReduction } from '../MathUtils';

export function updateBossEnemy(e: Enemy, currentSpd: number, dx: number, dy: number, pushX: number, pushY: number, state: GameState, onEvent?: (event: string, data?: any) => void) {
    const distToPlayer = Math.hypot(dx, dy);
    let vx = 0, vy = 0;

    // Level 2 Boss Logic (10 Minutes+)
    const isLevel2 = e.bossTier === 2 || (state.gameTime > 600 && e.bossTier !== 1);

    // --- SQUARE BOSS (THE FORTRESS) ---
    if (e.shape === 'square') {
        let effectiveSpd = currentSpd;
        if (isLevel2) {
            e.thorns = 0.03; // 3% Dmg Return
            effectiveSpd = currentSpd * 0.85; // Slower
        }
        // Standard Chase
        const angle = Math.atan2(dy, dx);
        vx = Math.cos(angle) * effectiveSpd + pushX;
        vy = Math.sin(angle) * effectiveSpd + pushY;
        return { vx, vy };
    }

    // --- CIRCLE BOSS (THE WARLORD) ---
    if (e.shape === 'circle' && isLevel2) {
        if (!e.dashTimer) e.dashTimer = 0;
        e.dashTimer++;
        const CD = 300; // 5s

        // 0-CD: Cooldown/Stalk
        if (e.dashState !== 1 && e.dashState !== 2) {
            // Stalk Logic
            if (distToPlayer < 600 && e.dashTimer > CD) {
                e.dashState = 1; // Enter Lock-on
                e.dashTimer = 0;
                e.dashLockX = state.player.x;
                e.dashLockY = state.player.y;
            }
            // Standard Chase
            const angle = Math.atan2(dy, dx);
            vx = Math.cos(angle) * currentSpd + pushX;
            vy = Math.sin(angle) * currentSpd + pushY;
        }
        else if (e.dashState === 1) {
            // Lock-On Phase (0.5s = 30 frames)
            vx = 0; vy = 0; // Stop
            if (e.dashTimer > 30) {
                e.dashState = 2; // Dash!
                e.dashTimer = 0;
                // Calculate Dash Vector
                const dashAngle = Math.atan2((e.dashLockY || 0) - e.y, (e.dashLockX || 0) - e.x);
                e.dashAngle = dashAngle;
            }
        }
        else if (e.dashState === 2) {
            // Dashing (0.5s duration?)
            vx = Math.cos(e.dashAngle || 0) * (currentSpd * 5);
            vy = Math.sin(e.dashAngle || 0) * (currentSpd * 5);
            if (e.dashTimer > 30) {
                e.dashState = 0; // Reset
                e.dashTimer = 0;
            }
        }
        return { vx, vy };
    }

    // --- TRIANGLE BOSS (THE REAPER) ---
    if (e.shape === 'triangle' && isLevel2) {
        if (!e.berserkTimer) e.berserkTimer = 0;
        e.berserkTimer++;

        const CD = 300; // 5s Cooldown
        const DURATION = 300; // 5s Duration

        if (!e.berserkState) {
            // Normal State
            if (distToPlayer < 600 && e.berserkTimer > CD) {
                e.berserkState = true;
                e.berserkTimer = 0;
            }
        } else {
            // Berserk State
            if (e.berserkTimer > DURATION) {
                e.berserkState = false;
                e.berserkTimer = 0;
            }
        }

        const modifier = e.berserkState ? 2.55 : 1.0;
        const finalSpd = currentSpd * modifier;
        const angle = Math.atan2(dy, dx);

        // Wobble while berserk
        const wobble = e.berserkState ? Math.sin(state.gameTime * 20) * 0.5 : 0;

        // Spin Logic
        e.rotationPhase = (e.rotationPhase || 0) + (e.berserkState ? 0.3 : 0.05);

        vx = Math.cos(angle + wobble) * finalSpd + pushX;
        vy = Math.sin(angle + wobble) * finalSpd + pushY;
        return { vx, vy };
    }

    // --- DIAMOND BOSS (THE MARKSMAN) ---
    if (e.shape === 'diamond' && isLevel2) {
        if (!e.beamTimer) e.beamTimer = 0;
        e.beamTimer++;
        if (!e.beamState) e.beamState = 0;

        const CD = 300; // 5s

        if (e.beamState === 0) {
            // Kiting / Cooldown Phase
            if (!e.distGoal) e.distGoal = 600 + Math.random() * 200;
            const dist = Math.hypot(dx, dy);
            const distFactor = (dist - e.distGoal) / 100;

            const angle = Math.atan2(dy, dx);
            vx = Math.cos(angle) * distFactor * currentSpd + pushX;
            vy = Math.sin(angle) * distFactor * currentSpd + pushY;

            if (e.beamTimer > CD) {
                e.beamState = 1; // Charge
                e.beamTimer = 0;
                e.beamX = state.player.x;
                e.beamY = state.player.y;
            }
        } else if (e.beamState === 1) {
            // Charge (1s total = 60 frames)
            vx = 0; vy = 0;

            if (e.beamTimer <= 30) {
                // Phase 1: Tracking (0.5s)
                e.beamX = state.player.x;
                e.beamY = state.player.y;
                e.beamAngle = Math.atan2(e.beamY - e.y, e.beamX - e.x);
            } else {
                // Phase 2: Locked (0.5s) - DO NOT update beamX/Y/Angle
                // This is the player's window to dodge!
            }

            if (e.beamTimer > 60) {
                e.beamState = 2; // Fire
                e.beamTimer = 0;
                e.hasHitThisBurst = false;
                playSfx('laser');
            }
        } else if (e.beamState === 2) {
            // Fire (Instant Burst + Linger Visual)
            vx = 0; vy = 0;

            const laserAngle = e.beamAngle || 0;
            const px = state.player.x - e.x;
            const py = state.player.y - e.y;
            const pDist = Math.hypot(px, py);
            const pAngle = Math.atan2(py, px);
            const angleDiff = Math.abs(pAngle - laserAngle);
            const normalizedDiff = Math.min(angleDiff, Math.abs(angleDiff - Math.PI * 2));

            // Laser Damage Logic (Once per burst)
            if (normalizedDiff < 0.1 && pDist < 3000 && !e.hasHitThisBurst) {
                e.hasHitThisBurst = true;
                const rawDmg = e.maxHp * 0.05; // 5% of Boss Max HP

                // LASER REDUCTION LOGIC
                // User: LVL 1 is reduced by armor. LVL 2 PIERCES ALL ARMOR.
                let finalDmg = rawDmg;
                if (!isLevel2) {
                    const armor = calcStat(state.player.arm);
                    const reduction = getDefenseReduction(armor);
                    finalDmg = rawDmg * (1 - reduction);

                    // Track Stats
                    state.player.damageBlockedByArmor += (rawDmg - finalDmg);
                    state.player.damageBlocked += (rawDmg - finalDmg);
                }

                state.player.curHp -= finalDmg;
                state.player.damageTaken += finalDmg;

                spawnFloatingNumber(state, state.player.x, state.player.y, Math.round(finalDmg).toString(), e.palette[1], isLevel2); // LVL 2 gets Crit look (larger)
                spawnParticles(state, state.player.x, state.player.y, e.palette[1], 10);

                if (state.player.curHp <= 0) {
                    state.player.curHp = 0;
                    state.gameOver = true;
                    if (onEvent) onEvent('game_over');
                }
            }

            // Zombie Insta-Kill
            state.enemies.forEach(z => {
                if (z.isZombie && z.zombieState === 'active' && !z.dead) {
                    const zdx = z.x - e.x, zdy = z.y - e.y;
                    const zDist = Math.hypot(zdx, zdy);
                    const zAngle = Math.atan2(zdy, zdx);
                    const zAngleDiff = Math.abs(zAngle - laserAngle);
                    const zNormDiff = Math.min(zAngleDiff, Math.abs(zAngleDiff - Math.PI * 2));

                    if (zNormDiff < 0.1 && zDist < 3000) {
                        z.dead = true; z.hp = 0;
                        spawnParticles(state, z.x, z.y, '#4ade80', 10);
                    }
                }
            });

            if (e.beamTimer > 30) { // 0.5s Fire animation
                e.beamState = 0;
                e.beamTimer = 0;
            }
        }
        return { vx, vy };
    }

    // --- PENTAGON BOSS (THE OMEGA) ---
    if (e.shape === 'pentagon' && isLevel2) {
        // Soul Link Aura Logic
        // Find enemies within 500
        e.soulLinkTargets = [];
        state.enemies.forEach(other => {
            if (other.id !== e.id && !other.dead) {
                // Restriction: Only Normal and Elite enemies (No Bosses, Zombies, Snitches, Minions)
                if (other.boss || other.isZombie || other.shape === 'snitch' || other.shape === 'minion') {
                    // Force unlink if previously linked
                    if (other.soulLinkHostId === e.id) other.soulLinkHostId = undefined;
                    return;
                }

                const d = Math.hypot(other.x - e.x, other.y - e.y);
                if (d < 500) {
                    e.soulLinkTargets!.push(other.id);
                    other.soulLinkHostId = e.id;
                } else {
                    if (other.soulLinkHostId === e.id) other.soulLinkHostId = undefined; // Unlink
                }
            }
        });
    }

    // Default Fallback / Pentagon Movement
    if (e.shape === 'pentagon') {
        const pMod = isLevel2 ? 0.8 : 1.0; // Slower if Lvl 2
        const angle = Math.atan2(dy, dx);
        vx = Math.cos(angle) * (currentSpd * pMod) + pushX;
        vy = Math.sin(angle) * (currentSpd * pMod) + pushY;
        return { vx, vy };
    }

    // Default Fallback
    const angle = Math.atan2(dy, dx);
    vx = Math.cos(angle) * currentSpd + pushX;
    vy = Math.sin(angle) * currentSpd + pushY;
    return { vx, vy };
}
