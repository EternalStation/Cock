import type { GameState, GameEventType, GameEvent } from './types';
import { playSfx } from './AudioLogic';

const EVENT_CHANCE = 0.4; // 40% chance every check
const CHECK_INTERVAL = 120; // Check every 2 minutes (120s)
const MIN_TIME_FOR_EVENTS = 60; // Start events after 1 minute

export function updateDirector(state: GameState, step: number) {
    if (state.gameOver || state.isPaused) return;

    // 1. Check for new events
    if (state.gameTime >= state.nextEventCheckTime && !state.activeEvent) {
        if (Math.random() < EVENT_CHANCE && state.gameTime > MIN_TIME_FOR_EVENTS) {
            const pool: GameEventType[] = ['red_moon', 'necrotic_surge', 'solar_emp']; // Starting with 3
            const type = pool[Math.floor(Math.random() * pool.length)];
            startEvent(state, type);
        }
        state.nextEventCheckTime = state.gameTime + CHECK_INTERVAL;
    }

    // 2. Update existing event
    if (state.activeEvent) {
        updateActiveEvent(state, step);
    }
}

function startEvent(state: GameState, type: GameEventType) {
    let duration = 60; // Default 1 minute

    // Necrotic Surge is shorter
    if (type === 'necrotic_surge') {
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
                palette: ['#57534e', '#44403c', '#292524'], // Dark stone/dirty brown
                eraPalette: ['#57534e', '#44403c', '#292524'],
                fluxState: 0,
                pulsePhase: 0,
                rotationPhase: 0,
                knockback: { x: 0, y: 0 },
                isRare: false,
                isElite: false,
                xpRewardMult: 0.5, // 50% XP
                spawnedAt: state.gameTime
            };
            state.enemies.push(eventZombie);

            // Visual feedback
            import('./ParticleLogic').then(({ spawnParticles }) => {
                spawnParticles(state, zombieData.x, zombieData.y, '#57534e', 10);
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
