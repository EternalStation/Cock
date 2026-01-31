
# Projectile Logic (ProjectileLogic.ts)

Manages all projectiles in the game, both from the player and enemies.

## Key Responsibilities

1. **Update Loop**:
   - Moves all projectiles based on their velocity vectors.
   - Updates timers (lifetime).
   - Handles tracking logic for homing projectiles.

2. **Collision Detection**:
   - **Player Bullets vs Enemies**: Checks for hits, applies damage, handles pierce/chain/fork mechanics.
   - **Enemy Bullets vs Player**: Checks for hits on the player.

3. **Special Behaviors**:
   - **Skills**: Handles logic for special projectiles like `ComWave`, `Orbitals`, and `Drones`.
   - **Visuals**: Spawns particles on impact.

## Configuration
Values are pulled from `GAME_CONFIG.PROJECTILE` and `GAME_CONFIG.SKILLS`.
