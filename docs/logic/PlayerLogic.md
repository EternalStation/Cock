
# Player Logic (PlayerLogic.ts)

Handles the core player state, movement, and interactions.

## Key Responsibilities

1. **Movement**:
   - Calculates velocity based on input (WASD/Arrows).
   - Applies friction and acceleration constants from `GAME_CONFIG`.
   - Handles wall collisions and "bounce" mechanics.

2. **Combat**:
   - **Shooting**: Manages fire rate and bullet creation (delegates to `ProjectileLogic`).
   - **Skills**: Executes active skills (Blink, Rapid Fire, etc.) and passive triggers (ComWave).
   - **Damage**: Handles taking damage, I-frames, and Shield logic.
   - **Knockback**: Applies and decays knockback forces.

3. **State Management**:
   - Updates cooldowns.
   - Manages XP collection and leveling up.
   - Tracks stats (kills, shots fired, etc.).

## Configuration
Values are pulled from `GAME_CONFIG.PLAYER` and `GAME_CONFIG.SKILLS`.
