
# Enemy Logic System

The enemy logic system controls the behavior, spawning, and management of enemies in the game. It has been refactored into modular components to improve maintainability.

## Modules

### 1. EnemyLogic.ts
The core controller for enemy entities.
- **Responsibilities**:
  - Main `updateEnemies` loop.
  - Enemy movement and physics (using `GAME_CONFIG`).
  - Collision detection with player and projectiles.
  - Delegating spawning and merging tasks to sub-modules.
  - Handling enemy death and rewards.

### 2. EnemySpawnLogic.ts
Handles the creation and spawning rules for enemies.
- **Responsibilities**:
  - `spawnEnemy`: Creates standard enemies based on game time and difficulty.
  - `spawnRareEnemy`: Manages the spawning of rare enemies (e.g., Snitch).
  - `manageRareSpawnCycles`: Controls the timing and phases of rare enemy appearances.
  - **Inputs**: Takes `GameState` to determine spawn positions and types.

### 3. EnemyMergeLogic.ts
Manages the "Swarm" mechanic where enemies merge into stronger variants.
- **Responsibilities**:
  - `handleEnemyMerging`: Checks for overlapping enemies and merges them.
  - Supports merging of Normal enemies into Elites.
  - Visual effects for merging.

## Key Concepts

- **Scaling**: Enemies grow stronger over time based on `score` and `gameTime`.
- **Bosses**: Special logic for boss spawning and behavior (handled within `EnemyLogic` and specialized boss modules if applicable).
- **Navigation**: Enemies use basic tracking with some physics (repulsion) to avoid clumping too much (unless merging).

## Integration

The `updateEnemies` function in `EnemyLogic.ts` is called every frame by the main game loop. It orchestrates the flow:
1. Update positions.
2. Check collisions.
3. Call `handleEnemyMerging`.
4. Call `spawnEnemy` / `spawnRareEnemy` based on timers.
