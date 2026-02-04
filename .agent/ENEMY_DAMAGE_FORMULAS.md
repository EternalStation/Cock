# Enemy Damage Formulas Blueprint

**Last Updated:** 2026-02-03  
**Status:** ✅ Active Implementation

---

## Overview

This document contains all exact formulas for enemy damage scaling in the game. These formulas control how enemy threat increases over time.

---

## 1. Enemy Base HP Growth Over Time

### Formula
```typescript
const minutes = gameTime / 60;
const cycleCount = Math.floor(minutes / 5);
const difficultyMult = 1 + (minutes * Math.log2(2 + minutes) / 30);
const hpMult = Math.pow(1.2, cycleCount) * SHAPE_DEFS[chosenShape].hpMult;
const baseHp = 80 * Math.pow(1.186, minutes) * difficultyMult;
const finalHP = baseHp * hpMult;
```

### Components
- **Starting HP:** `80`
- **Base Exponential:** `1.186^minutes`
- **Difficulty Multiplier:** `1 + (minutes * log₂(2 + minutes) / 30)`
- **Cycle Multiplier:** `1.2^floor(minutes/5)`
- **Shape Multiplier:** Varies by enemy type (from `SHAPE_DEFS`)

### Boss Multiplier
- **Boss HP:** `finalHP * 15`

### Event Modifiers
- **Red Moon Event:** `finalHP * 1.5` (+50% HP boost)

### Reference Table

| Time (min) | Base HP | Difficulty Mult | Cycle Mult | Final HP | Boss HP (15x) |
|------------|---------|-----------------|------------|----------|---------------|
| 0 | 80 | 1.000 | 1.000 | 80 | 1,200 |
| 10 | 651 | 2.195 | 1.440 | 1,392 | 20,880 |
| **20** | 6,983 | 3.973 | 2.074 | **19,981** | 299,715 |
| 30 | 62,529 | 6.000 | 2.986 | 239,260 | 3,588,900 |
| 40 | 506,046 | 8.190 | 4.300 | 2,589,396 | 38,840,940 |
| 50 | 3,847,028 | 10.501 | 6.192 | 26,324,280 | 394,864,200 |
| **60** | 28,039,164 | 12.908 | 8.916 | **256,577,428** | 3,848,661,420 |
| 70 | 198,290,455 | 15.396 | 12.839 | 2,426,484,017 | 36,397,260,255 |
| 80 | 1,370,931,116 | 17.953 | 18.488 | 22,434,350,205 | 336,515,253,075 |
| 90 | 9,313,289,533 | 20.571 | 26.623 | 203,808,926,078 | 3,057,133,891,170 |
| 100 | 62,388,435,910 | 23.241 | 38.338 | 1,825,771,521,977 | 27,386,572,829,655 |

### Design Targets
- ✅ **20 minutes:** ~20,000 HP
- ✅ **60 minutes:** ~250,000,000 HP

---

## 2. Enemy Collision Damage Growth Over Time

### Formula
```typescript
// Base collision damage (15% of current HP)
let rawDmg = enemy.hp * 0.15;

// Combat Hex Arena Bonus (+15%)
if (state.currentArena === 1 && !enemy.isNeutral) {
    rawDmg *= 1.15; // Total: 17.25% of HP
}

// Special Cases:
// Minions (Normal): mother.hp * MINION_DAMAGE_RATIO
// Minions (Stun): mother.hp * MINION_STUN_DAMAGE_RATIO
// Custom Collision: (enemy.hp / enemy.maxHp) * enemy.customCollisionDmg
```

### Base Formula
- **Standard Collision:** `enemy.hp * 0.15` (15% of current HP)
- **Combat Hex:** `enemy.hp * 0.15 * 1.15` (17.25% of current HP)

### Damage Reduction (Player Side)
```typescript
// Armor Reduction
const armRedMult = 1 - (0.95 * (armor / (armor + 5263)));
const dmgAfterArmor = rawDmg * armRedMult;

// Collision Reduction Perk (Aegis Protocol)
const colRed = Math.min(80, colRedRaw); // Capped at 80%
const colRedMult = 1 - (colRed / 100);
const reducedDmg = dmgAfterArmor * colRedMult;
```

### Reference Table (Normal Arena)

| Time (min) | Enemy HP | Collision Dmg (15%) | Combat Hex (17.25%) |
|------------|----------|---------------------|---------------------|
| 0 | 80 | 12 | 14 |
| 10 | 1,392 | 209 | 240 |
| 20 | 19,981 | 2,997 | 3,447 |
| 30 | 239,260 | 35,889 | 41,272 |
| 40 | 2,589,396 | 388,409 | 446,671 |
| 50 | 26,324,280 | 3,948,642 | 4,540,938 |
| 60 | 256,577,428 | 38,486,614 | 44,259,606 |
| 70 | 2,426,484,017 | 363,972,603 | 418,568,493 |
| 80 | 22,434,350,205 | 3,365,152,531 | 3,869,925,411 |

### Special Cases
- **Neutral Objects (Barrels):** 0 damage
- **Zombies:** Do not deal collision damage
- **Legion Enemies:** Damage shield instead if active

---

## 3. Enemy Projectile Damage Growth Over Time

### Formula (Diamond Enemies)
```typescript
// Diamond shape enemies shoot projectiles
const dmg = Math.floor(enemy.maxHp * 0.30); // 30% of max HP
const cooldown = 6000; // 6 seconds between shots

// Spawn projectile
spawnEnemyBullet(state, enemy.x, enemy.y, angleToPlayer, dmg, bulletColor);
```

### Projectile Properties
- **Damage:** `floor(enemy.maxHp * 0.30)` (30% of max HP)
- **Fire Rate:** Every 6 seconds
- **Speed:** 6 units/frame
- **Pierce:** 1 (hits once)
- **Lifetime:** 300 frames (~5 seconds)
- **Size:** 6 units
- **Color:** Current era palette bright color

### Reference Table

| Time (min) | Enemy Max HP | Projectile Dmg (30%) | DPS (per enemy) |
|------------|--------------|----------------------|-----------------|
| 0 | 80 | 24 | 4 |
| 10 | 1,392 | 418 | 70 |
| 20 | 19,981 | 5,994 | 999 |
| 30 | 239,260 | 71,778 | 11,963 |
| 40 | 2,589,396 | 776,819 | 129,470 |
| 50 | 26,324,280 | 7,897,284 | 1,316,214 |
| 60 | 256,577,428 | 76,973,228 | 12,828,871 |
| 70 | 2,426,484,017 | 727,945,205 | 121,324,201 |
| 80 | 22,434,350,205 | 6,730,305,062 | 1,121,717,510 |

### Enemy Types with Projectiles
- **Diamond:** Standard projectile (30% max HP, 6s cooldown)
- **Boss Types:** May have special attack patterns (varies)

---

## 4. Shape-Specific Multipliers

### Shape Definitions (from SHAPE_DEFS)
Each enemy shape has unique multipliers:

```typescript
{
  circle: { hpMult: 1.0, speedMult: 1.0, sizeMult: 1.0 },
  triangle: { hpMult: 0.8, speedMult: 1.2, sizeMult: 0.9 },
  square: { hpMult: 1.2, speedMult: 0.8, sizeMult: 1.1 },
  diamond: { hpMult: 1.0, speedMult: 1.0, sizeMult: 1.0 },
  pentagon: { hpMult: 1.5, speedMult: 0.7, sizeMult: 1.2 }
}
```

### Effective HP by Shape (60 minutes)

| Shape | HP Multiplier | Final HP | Collision Dmg | Projectile Dmg |
|-------|---------------|----------|---------------|----------------|
| Circle | 1.0x | 256,577,428 | 38,486,614 | 76,973,228 |
| Triangle | 0.8x | 205,261,942 | 30,789,291 | 61,578,583 |
| Square | 1.2x | 307,892,914 | 46,183,937 | 92,367,874 |
| Diamond | 1.0x | 256,577,428 | 38,486,614 | 76,973,228 |
| Pentagon | 1.5x | 384,866,142 | 57,729,921 | 115,459,843 |

---

## 5. Arena-Specific Modifiers

### Combat Hex (Arena 1)
```typescript
// Collision Damage: +15%
if (state.currentArena === 1 && !enemy.isNeutral) {
    rawDmg *= 1.15;
}

// Spawn Rate: Increased (handled in DirectorLogic)
```

### Defense Hex (Arena 2)
```typescript
// Player receives:
// - +20% Max HP
// - +20% Regeneration
// (No direct enemy damage modifiers)
```

### Economic Hex (Arena 0)
```typescript
// Player receives:
// - +15% Meteorite Drop Chance
// - +15% XP Gain
// (No direct enemy damage modifiers)
```

---

## 6. Implementation Locations

### Files Modified
1. **`src/logic/enemies/EnemySpawnLogic.ts`** (Line 83)
   - Enemy HP calculation
   
2. **`src/logic/PlayerLogic.ts`** (Lines 286-302)
   - Collision damage calculation
   
3. **`src/logic/enemies/NormalEnemyLogic.ts`** (Line 87)
   - Projectile damage calculation

### Key Constants
```typescript
// From GameConfig
ENEMY: {
  CONTACT_DAMAGE_PERCENT: 0.15,        // 15% of HP
  MINION_DAMAGE_RATIO: 0.10,           // Minion collision
  MINION_STUN_DAMAGE_RATIO: 0.05,      // Stun minion collision
  SNITCH_HP: 100,                       // Rare enemy HP
  SNITCH_SPEED_MULT: 1.5               // Rare enemy speed
}

PLAYER: {
  ARMOR_CONSTANT: 5263,                 // Armor reduction formula
  WALL_DAMAGE_PERCENT: 0.05,           // Wall collision (5% max HP)
  WALL_BOUNCE_SPEED: 15,               // Knockback velocity
  KNOCKBACK_DECAY: 0.85                // Momentum decay
}
```

---

## 7. Summary of All Damage Sources

### Enemy → Player Damage Types

1. **Collision Damage**
   - Formula: `enemy.hp * 0.15`
   - Frequency: On contact (with cooldown)
   - Affected by: Armor, Aegis Protocol perk, Epicenter shield

2. **Projectile Damage**
   - Formula: `floor(enemy.maxHp * 0.30)`
   - Frequency: Every 6 seconds (Diamond only)
   - Affected by: Projectile reduction perks, shields

3. **Wall Collision Damage** (Player self-damage)
   - Formula: `player.maxHp * 0.05`
   - Frequency: On wall collision
   - Affected by: Armor only

---

## 8. Validation Checklist

- ✅ HP at 20 min = ~20,000
- ✅ HP at 60 min = ~250,000,000
- ✅ Collision damage = 15% of current HP
- ✅ Projectile damage = 30% of max HP
- ✅ Combat Hex bonus = +15% collision damage
- ✅ Boss multiplier = 15x HP
- ✅ Red Moon event = +50% HP

---

## 9. Future Considerations

### Potential Adjustments
- Monitor player feedback on difficulty curve
- Consider adding difficulty multiplier for projectile damage
- Evaluate boss HP scaling at extreme late game (100+ minutes)
- Review minion damage ratios for balance

### Testing Recommendations
- Test player survivability at 20, 40, 60 minute marks
- Verify armor effectiveness against scaled damage
- Ensure Aegis Protocol cap (80%) provides meaningful protection
- Validate boss encounters feel appropriately challenging

---

**End of Blueprint**
