
# Game Configuration (GameConfig.ts)

The `GameConfig.ts` file serves as the centralized repository for all game constants, balance values, and configuration settings. It is designed to make balancing and tweaking the game easier by avoiding hardcoded values scattered throughout the codebase.

## Structure

The configuration is exported as a constant object `GAME_CONFIG`, which is categorized into logical sections:

### PLAYER
Contains player-related constants such as:
- **Movement Speed**: Base speed and acceleration.
- **Health & Shield**: Base HP, Shield values, Regens.
- **Combat Stats**: Base damage, armor, i-frames.
- **Physics**: Friction, wall bounce, hitbox radius.

### ENEMY
Defines base stats and behaviors for enemies:
- **Spawning**: Spawn rates, cap, merging distance.
- **Stats**: Base HP, Damage, XP values for different enemy types.
- **Scaling**: How enemy stats scale over time or waves.

### SKILLS
Configuration for player skills and abilities:
- **Active Skills**: Cooldowns, damage, durations (e.g., Blink, Rapid Fire).
- **Passive Skills**: Trigger chances, multipliers (e.g., Critical Hit, Sonic Wave).

### PROJECTILE
Settings for all projectiles:
- **Player Projectiles**: Speed, lifetime, size.
- **Enemy Projectiles**: Speed, damage, tracking.

### MAP
Map-related constants:
- **Dimensions**: World width and height.
- **Zones**: Definitions of different arena zones (Safe, Combat, etc.).

## Usage

To use these constants in other files, import `GAME_CONFIG`:

```typescript
import { GAME_CONFIG } from './GameConfig';

// Example usage
const speed = GAME_CONFIG.PLAYER.BASE_SPEED;
const damage = GAME_CONFIG.SKILLS.WAVE_DAMAGE_MULT.LVL1;
```

## Modifying Balance

To adjust game balance, locate the relevant key in `GAME_CONFIG` and update its value. This change will propagate to all systems referencing it.
