import type { GameState, GameEventType, GameEvent } from './types';
import { playSfx } from './AudioLogic';

const EVENT_CHANCE = 0.4; // 40% chance every check
const CHECK_INTERVAL = 120; // Check every 2 minutes (120s)
const MIN_TIME_FOR_EVENTS = 60; // Start events after 1 minute

export function updateDirector(state: GameState, step: number) {
    if (state.gameOver || state.isPaused) return;

    // 1. Check for new random events (Excluding scheduled ones)
    if (state.gameTime >= state.nextEventCheckTime && !state.activeEvent) {
        if (Math.random() < EVENT_CHANCE && state.gameTime > MIN_TIME_FOR_EVENTS) {
            const pool: GameEventType[] = ['red_moon', 'necrotic_surge', 'solar_emp']; // Removed legion_formation from random pool
            const type = pool[Math.floor(Math.random() * pool.length)];
            startEvent(state, type);
        }
        state.nextEventCheckTime = state.gameTime + CHECK_INTERVAL;
    }

    // 2. Scheduled Legion Formation (Min 10-12:59, 20-22:59, 30-32:59)
    const currentMin = Math.floor(state.gameTime / 60);
    const windowId = Math.floor(currentMin / 10);
    const inLegionWindow = currentMin >= 10 && (currentMin % 10) < 3;

    if (inLegionWindow && !state.activeEvent && state.lastLegionWindow !== windowId) {
        // Random chance to start during the 3-minute window (approx 1 in 180 seconds)
        // Check every frame (60 fps), so 1 / (180 * 60)
        if (Math.random() < 1 / (180 * 60)) {
            startEvent(state, 'legion_formation');
            state.lastLegionWindow = windowId;
        }
    }

    // 3. Update existing event
    if (state.activeEvent) {
        updateActiveEvent(state, step);
    }
}

function startEvent(state: GameState, type: GameEventType) {
    let duration = 60; // Default 1 minute

    // Necrotic Surge and Legion Formation are shorter
    if (type === 'necrotic_surge' || type === 'legion_formation') {
        duration = 30; // 30 seconds
    }

    const event: GameEvent = {
        type,
        startTime: state.gameTime,
        duration,
        endTime: state.gameTime + duration,
        data: {}
    };

    state.activeEvent = event;

    // Event Specific Initialization
    switch (type) {
        case 'red_moon':
            playSfx('warning'); // Sound cue
            break;
        case 'necrotic_surge':
            playSfx('rare-spawn');
            break;
        case 'solar_emp':
            playSfx('warning');
            break;
        case 'legion_formation':
            playSfx('warning'); // Maybe a horn?
            break;
    }

    console.log(`Director: Starting event ${type} for ${duration}s`);
}

function updateActiveEvent(state: GameState, _step: number) {
    if (!state.activeEvent) return;

    // Process pending zombie spawns
    if (state.activeEvent.pendingZombieSpawns && state.activeEvent.pendingZombieSpawns.length > 0) {
        const spawnsToProcess = state.activeEvent.pendingZombieSpawns.filter(z => state.gameTime >= z.spawnAt);

        spawnsToProcess.forEach(zombieData => {
            // Spawn the hostile zombie NOW
            const eventZombie: any = {
                id: Math.random(),
                type: zombieData.shape,
                shape: zombieData.shape,
                x: zombieData.x,
                y: zombieData.y,
                size: zombieData.size,
                hp: Math.floor(zombieData.maxHp * 0.5), // 50% HP
                maxHp: Math.floor(zombieData.maxHp * 0.5),
                spd: zombieData.spd,
                boss: false,
                bossType: 0,
                bossAttackPattern: 0,
                lastAttack: 0,
                dead: false,
                shellStage: 0,
                palette: ['#0f172a', '#4f46e5', '#818cf8'], // Void Indigo
                eraPalette: ['#0f172a', '#4f46e5', '#818cf8'],
                fluxState: 0,
                pulsePhase: 0,
                rotationPhase: 0,
                knockback: { x: 0, y: 0 },
                isElite: false,
                xpRewardMult: 0.5, // 50% XP
                spawnedAt: state.gameTime,
                frozen: 1.0, // Digging for 1 second
                summonState: 1, // Trigger digging animation in renderer
                isNecroticZombie: true // Prevent palette overrides
            };
            state.enemies.push(eventZombie);

            // Visual feedback - Void particles
            import('./ParticleLogic').then(({ spawnParticles }) => {
                spawnParticles(state, zombieData.x, zombieData.y, '#818cf8', 20);
            });
            import('./AudioLogic').then(({ playSfx }) => {
                playSfx('zombie-rise');
            });
        });

        // Remove processed spawns
        state.activeEvent.pendingZombieSpawns = state.activeEvent.pendingZombieSpawns.filter(
            z => state.gameTime < z.spawnAt
        );
    }

    // Handle end of event
    if (state.gameTime >= state.activeEvent.endTime) {
        console.log(`Director: Event ${state.activeEvent.type} ended`);
        state.activeEvent = null;
        return;
    }

    // Per-frame event logic (if needed)
    switch (state.activeEvent.type) {
        case 'red_moon':
            // Visual pulse or particles?
            if (state.frameCount % 60 === 0) {
                // spawn red particles randomly?
            }
            break;
    }
}

// Helper to check if a specific event is active
export function isEventActive(state: GameState, type: GameEventType): boolean {
    return state.activeEvent?.type === type;
}
