# Legion Scenario - Data & Mechanics Backup

**Status:** Current Implementation as of [Current Date]
**Purpose:** System reference for the "Legion Formation" event to ensure stability and restoration if code changes cause regression.

---

## 1. Trigger Protocol (`DirectorLogic.ts`)

*   **Activation Window:**
    *   Starts checking after **10 minutes** of game time (Cycle 2+).
    *   One event allowed per **5-minute cycle** (e.g., 10-15m, 15-20m).
    *   Does **not** overlap with other active events (e.g., Necrotic Surge).

*   **Probability:**
    *   Checks approximately every frame (1/60 chance roughly, effectively random within the minute window) to start *sometime* during current 5-minute cycle if one hasn't occurred yet.
    *   If a specific cycle (e.g., 10-15m) passes without an event, the opportunity is lost for that cycle.

*   **Duration:**
    *   **30 Seconds** hard duration.

*   **Audio/Visual:**
    *   Start SFX: `'warning'`

---

## 2. Global Spawn Modifiers (`EnemyLogic.ts`)

*   **Spawn Rate Multiplier:**
    *   **2.0x (Double)** base spawn rate while the event is active.
    *   *Purpose:* To rapidly generate enough fodder to form legions.

---

## 3. Legion Formation Mechanics (`EnemyLogic.ts`)

*   **Conditions:**
    *   Scans for **Normal** enemies only.
    *   *Excludes:* Elite, Boss, Zombie, Rare, or existing Legion members.
    *   **Threshold:** Triggers immediately when **30** candidates of the same **Shape** are available.

*   **Structure:**
    *   **Phalanx Grid:** 6 columns wide (x = index % 6, y = index / 6).
    *   **Units per Legion:** 30.

*   **The Phalanx Shield (Critical):**
    *   **Formula:** `Total HP of all 30 Members` * **2.0** (200%).
    *   **Type:** Shared Shield Pool (Attached to Legion Lead).
    *   **Damage Logic:**
        *   All damage taken by *any* member is subtracted from the **Shared Shield** first.
        *   Members take **0 HP Damage** while Shield > 0.
        *   Visual Feedback: Blue sparks & numbers.
    *   **Fallout:** Once shield hits 0, members take normal damage.

---

## 4. Legion AI & Behavior (`EnemyLogic.ts`)

*   **Movement (Phalanx):**
    *   **Base Speed:** **1.2x** Play Speed (Towards Player).
    *   **Catch-Up Speed:** **2.0x** (If out of formation slot).
    *   **Coordination:**
        *   Legions align relative to the Player.
        *   They form a "Wall" with **100px gap** between distinct legions.
        *   The "Lead" unit steers the entire block to ensure the closest member touches the target line.
    
*   **Physics:**
    *   **Push Force:** 
        *   Vs Other Enemies: **0.8** multiplier (Very strong, pushes others aside like a wall).
        *   Vs Self: **0.0** (No internal pushing to maintain perfect grid).

*   **Status Immunities:**
    *   **Fear:** Immune (Legionnaires do not flee).

---

## 5. Visual/Feedback Codes

*   **Shield Hit:** `spawnParticles(..., '#60a5fa', ...)` (Blue/Process Blue)
*   **Shield Numbers:** Colored `#60a5fa`.

---

**Restoration Instructions:**
If logic is lost, look for:
1. `DirectorLogic.ts` -> `updateDirector` for scheduling.
2. `EnemyLogic.ts` -> `updateEnemies` -> `Legion Formation` block for grouping/math.
3. `EnemyLogic.ts` -> `Behavior` block for movement/push overrides.
4. `ProjectileLogic.ts` -> Collision loop for Shield damage absorption hooks.
