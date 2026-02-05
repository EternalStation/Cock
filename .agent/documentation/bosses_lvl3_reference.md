# Bosses LVL 3 (20min+)

## Boss Reference
Level 3 Bosses are enhanced versions of Level 2 Bosses with additional unique abilities. They spawn on the same 2-minute rotation schedule but gain powerful new mechanics at the 20-minute mark.

### 1. Spawn Schedule & Rotation
Bosses spawn every **2 minutes** (120 seconds). The boss type rotates based on the game time minute:

| Game Time | Boss Type | Shape |
|-----------|-----------|-------|
| 2:00 | The Fortress | Square |
| 4:00 | The Overmind | Pentagon |
| 6:00 | The Blade | Triangle |
| 8:00 | The Marksman | Diamond |
| 10:00 | The Warlord | Circle |
| 12:00 | The Fortress | Square (Repeat) |

**Rotation Formula**: Minutes % 5 maps to [Circle, Triangle, Square, Diamond, Pentagon]. Note: The spawn logic results in the order: Square (2), Pentagon (4), Triangle (1/6), Diamond (3/8), Circle (0/10).

---

## 2. Stats

### Base Stats (All Bosses)
- **HP**: 15x Base Enemy HP (scales exponentially with time)
  - Formula: `60 * Math.pow(1.186, minutes) * 15`
  - Target: ~300k HP @ 20min, ~3.75M HP @ 60min
- **Size**: 60 units (Level 3)
- **Speed**: Same as their normal enemy counterpart (varies by shape)
- **XP**: Awards Normal XP (standard per-kill amount)
- **Main Reward**: Legendary Hex (Anomaly Tech) on defeat

### Level Progression
- **LVL 1** (0-10 min): Basic boss, no abilities
- **LVL 2** (10-20 min): Gains first unique ability
- **LVL 3** (20+ min): Gains second powerful ability

---

## 3. Boss-Specific Abilities

### THE FORTRESS (Square) - Level 3

**Level 2 Ability: THORNS**
- Reflects 3% of incoming damage back to the player
- Passive ability, always active

**Level 3 Ability: ORBITAL PLATING**
- **Description**: Deploys 3 orbital shield generators that grant complete invulnerability
- **Mechanics**:
  - Spawns with 3 shields on creation
  - Shields orbit at 150px radius from boss center
  - Shields orbit slowly (speed: 0.01 rad/frame)
  - Each shield has 10% of boss max HP
  - Shield size: 40 units (visual arc: 120°)
  - Shields are cyan/blue colored energy plates
- **Protection Bubble**:
  - 110px radius hexagonal force field around boss
  - Active while at least 1 shield is alive
  - Reflects ALL bullets that enter the bubble
  - Boss takes 0 damage while bubble is active (`takenDamageMultiplier = 0`)
- **Regeneration**: Shields respawn after 15 seconds if all are destroyed
- **Strategy**: Player must destroy all 3 shields to damage the boss

---

### THE WARLORD (Circle) - Level 3

**Level 2 Ability: BERSERK RUSH**
- **Cooldown**: 6.5 seconds (390 frames)
- **Range**: Activates when player is within 700px
- **Damage**: 30% of player's Max HP on impact
- **Mechanics**:
  - State 0: Cooldown/Stalk
  - State 1: Lock-on (60 frames / 1 second)
  - State 2: Dash execution
  - Visual: Red laser sight during lock-on

**Level 3 Ability: CYCLONE PULL**
- **Cooldown**: 10 seconds after activation
- **Activation**: When player is >400px away and dash is ready
- **Duration**: 5 seconds (300 frames)
- **Mechanics**:
  - Pulls player towards boss (pull strength: 0.86)
  - Boss remains stationary while pulling
  - Does NOT pull player projectiles (removed in latest version)
  - Visual: Boss spins rapidly during pull
- **Restrictions**: Cannot dash while pulling; must wait 2 seconds after pull ends before dashing

---

### THE BLADE (Triangle) - Level 3

**Level 2 Ability: BLADE SPIN (Berserk)**
- **Trigger**: Activates when HP drops below 50%
- **Duration**: Permanent once triggered
- **Effects**:
  - Movement speed: 2.55x multiplier
  - Wobble movement pattern
  - Yellow jagged aura
  - Increased aggression

**Level 3 Ability: DEFLECTION FIELD**
- **Active**: Only while in Berserk state (HP < 50%)
- **Mechanics**:
  - 50% chance to deflect incoming projectiles
  - Deflected bullets scatter in random wide angles (±160° spread)
  - Bullets maintain original speed
  - Visual feedback on deflection
- **Strategy**: High-risk high-reward - boss becomes extremely dangerous when low on HP

---

### THE MARKSMAN (Diamond) - Level 3

**Level 2 Ability: HYPER BEAM**
- **Cooldown**: 8 seconds (480 frames)
- **Mechanics**:
  - State 0: Cooldown
  - State 1: Charge (60 frames / 1 second) - locks onto player position
  - State 2: Fire (30 frames / 0.5 second)
- **Damage**: 5% of player's Max HP
- **Visual**:
  - Thin guide line during charge (brightens when locked)
  - Charge buildup glow at boss
  - Beam fires in locked direction
- **Note**: LVL 1 beam is reduced by armor; LVL 2 PIERCES ALL ARMOR

**Level 3 Ability: SATELLITE STRIKE**
- **Cooldown**: 10 seconds (600 frames)
- **Mechanics**:
  - Marks 3 zones in triangle formation around player
  - Warning phase: 1.5 seconds (90 frames)
  - Strike phase: Instant damage + visual beam
  - Damage: 3% of Boss Max HP per zone
  - Hit radius: 60px per zone
- **Visuals**:
  - Orbiting satellite indicator (small diamond, 8px)
  - Warning particles on ground (era-colored)
  - Cosmic Beam-style strike animation (era-colored)
  - Beam fades over 20 frames
- **Era Colors**:
  - 0-15 min: Green (#4ade80)
  - 15-30 min: Blue (#3b82f6)
  - 30-45 min: Purple (#a855f7)
  - 45-60 min: Orange (#f97316)

---

### THE OVERMIND (Pentagon) - Level 3

**Level 2 Ability: SOUL LINK**
- **Range**: 500px radius
- **Mechanics**:
  - Links to nearby normal and elite enemies (not bosses, zombies, snitches, or minions)
  - Linked enemies share damage with boss
  - Contact with linked enemy: 30% HP damage to player, destroys enemy, damages boss
  - Shared HP pool concept
- **Visual**: Smooth snake-like lines (era-colored) connecting boss to linked enemies

**Level 3 Ability: PARASITIC LINK**
- **Activation**: When player is within 500px
- **Break Range**: Player must move >800px away to break link
- **Damage**: 3% of player's Max HP per second
- **Healing**: Drains heal the boss (if boss HP < max HP)
- **Visual**: 
  - Distorted glitchy tether from boss to player
  - 8 overlapping segments with random glitch offsets
  - Alternating bright/dark era colors
  - Pulsing line width (3 ± 1.5)
  - Shadow glow effect (15px blur)
  - Crackling particles along tether (every 3 frames)
- **Sound**: Warning sound on activation

---

## 4. Behavior

### AI Pattern (All Level 3 Bosses)
- **Movement**: Direct Chase AI - moves towards player at constant speed
- **Abilities**: Each boss manages its own ability timers and states
- **Aggression**: Persistent tracking, no retreat behavior
- **Invulnerability**: Only The Fortress has conditional invulnerability (via shields)

### Damage Multiplier System
- Bosses manage their own `takenDamageMultiplier`
- The Fortress: 0 while shields active, 1.0 when vulnerable
- All others: 1.0 (normal damage)
- Multiplier is NOT reset by the general enemy update loop (bosses are excluded)

---

## 5. Visuals

### Color System
- **Era Palette**: Shifts every 15 minutes
  - 0-15 min: Green (#4ade80, #22c55e, #16a34a)
  - 15-30 min: Blue (#3b82f6, #2563eb, #1d4ed8)
  - 30-45 min: Purple (#a855f7, #9333ea, #7e22ce)
  - 45-60 min: Orange (#f97316, #ea580c, #c2410c)

### Boss-Specific Effects

**All Bosses:**
- **Wobble/Distortion**: Visual power signifier
- **Glow**: High intensity bloom/shadow
- **Screen Darkening**: Slight dim when boss is active
- **Boss Level Text**: Displays in era color (not fixed red)

**The Fortress (Square):**
- Hexagonal cyan force field (110px radius, 0.4 alpha)
- Orbital shields: Curved energy plates (120° arc, cyan/blue)
- Grey armor spark particles when invulnerable

**The Warlord (Circle):**
- Red laser sight during dash lock-on
- Rapid spin animation during Cyclone Pull

**The Blade (Triangle):**
- Yellow jagged aura when berserk
- Intense wobble pattern

**The Marksman (Diamond):**
- Charge buildup glow (scales with charge progress)
- Thin guide line (brightens when locked)
- Orbiting satellite (8px diamond, era-colored glow)
- Cosmic Beam strike (era-colored, 120px wide, 2000px tall)

**The Overmind (Pentagon):**
- Smooth snake lines to linked enemies (era-colored)
- Glitchy distorted player tether (era-colored, 8 segments)
- Crackling particles on tether

---

## 6. Rewards

### Legendary Upgrades
- **Drop**: Defeating a boss drops a **Legendary Hex** (Anomaly Tech)
- **XP**: Bosses award Normal XP (standard per-kill amount)
- **Main Value**: The Legendary Hex is the primary reward

---

## 7. Technical Implementation Notes

### File Locations
- **Boss Logic**: `src/logic/enemies/BossEnemyLogic.ts`
- **Enemy Update**: `src/logic/EnemyLogic.ts`
- **Shield Spawning**: `src/logic/enemies/EnemySpawnLogic.ts`
- **Rendering**: `src/logic/renderers/EntityRenderer.ts`
- **Projectile Interaction**: `src/logic/ProjectileLogic.ts`
- **UI**: `src/components/hud/BossStatus.tsx`

### Key Properties (Enemy Type)
```typescript
{
  boss: true,
  bossTier: 3, // 0=Auto, 1=Lvl1, 2=Lvl2, 3=Lvl3
  shape: 'square' | 'circle' | 'triangle' | 'diamond' | 'pentagon',
  size: 60,
  hp: number, // 15x base enemy HP
  maxHp: number,
  
  // Square Boss
  orbitalShields?: number, // Count of active shields
  shieldsInitialized?: boolean,
  takenDamageMultiplier?: number, // 0 or 1.0
  
  // Circle Boss
  dashTimer?: number,
  dashState?: number, // 0=CD, 1=Lock, 2=Dash
  dashLockX?: number,
  dashLockY?: number,
  cycloneState?: number, // 0=Idle, 1=Spinning
  cycloneTimer?: number,
  
  // Triangle Boss
  berserkState?: boolean,
  deflectState?: boolean,
  
  // Diamond Boss
  beamState?: number, // 0=CD, 1=Charge, 2=Fire
  beamTimer?: number,
  beamX?: number,
  beamY?: number,
  beamAngle?: number,
  satelliteState?: number, // 0=Idle, 1=Warning, 2=Strike
  satelliteTimer?: number,
  satelliteTargets?: Array<{x: number, y: number}>,
  
  // Pentagon Boss
  soulLinkTargets?: number[], // IDs of linked enemies
  parasiteLinkActive?: boolean,
}
```

### Shield Enemy Properties
```typescript
{
  id: number,
  type: 'orbital_shield',
  shape: 'orbital_shield',
  x: number,
  y: number,
  size: 40,
  hp: number, // 10% of parent boss max HP
  maxHp: number,
  parentId: number, // Boss ID
  rotationPhase: number, // Orbit angle
}
```

---

## 8. Balance Notes

### The Fortress (Square)
- **Strength**: Complete invulnerability while shields are active
- **Weakness**: Shields can be destroyed; boss is vulnerable during 15s respawn window
- **Difficulty**: High - requires focused shield destruction

### The Warlord (Circle)
- **Strength**: High mobility, strong pull mechanic
- **Weakness**: Predictable dash pattern, stationary during pull
- **Difficulty**: Medium-High - requires good positioning

### The Blade (Triangle)
- **Strength**: Extreme speed when berserk, deflects projectiles
- **Weakness**: Becomes more dangerous when low HP (risk/reward)
- **Difficulty**: High - becomes harder as fight progresses

### The Marksman (Diamond)
- **Strength**: Long-range attacks, area denial with satellite strikes
- **Weakness**: Telegraphed attacks with warning phases
- **Difficulty**: Medium - requires awareness and dodging

### The Overmind (Pentagon)
- **Strength**: Linked enemies create complex battlefield, life drain
- **Weakness**: Can be kited beyond link range
- **Difficulty**: Medium-High - requires managing multiple threats

---

## 9. Known Issues & Future Considerations

### Current State (Working)
- All abilities functional and tested
- Visual effects properly implemented
- Era color system working
- Boss UI displays correctly

### Potential Improvements
- Add unique death animations per boss
- Boss-specific music tracks
- Achievement system for defeating all Level 3 bosses
- Hard mode variants with enhanced abilities

---

**Last Updated**: 2026-02-05
**Game Version**: Current Development Build
**Documentation Version**: 1.0
