# Legion Scenario - Data & Mechanics Backup

**Status:** Simplified Implementation - February 5, 2026
**Purpose:** System reference for the "Legion Formation" event.

---

## 1. Trigger Protocol (`DirectorLogic.ts`)

*   **Activation Window:** After 10 minutes (Cycle 2+).
*   **Cycle:** One event per 5-minute window.
*   **Duration:** Lasts until the specific spawned Legion is completely destroyed.
*   **Behavior:** Spawns exactly one Legion (30 units) at the start of the event.

---

## 2. Spawn Mechanics (`EnemyLogic.ts`)

*   **Logic:** Instantly spawns a 30-unit grid 1500px away from the player.
*   **Units:** Uses the current **Shape** and **Era Palette** based on game time.
*   **Stats:** Standard scaling for the current minute.
*   **Phalanx Shield:** Shared pool established immediately = **200% combined HP**.
    *   Shared shield absorbs all damage to units until destroyed.
    *   Units are fully hittable/vulnerable (no assembly immunity).

---

## 3. Movement & Behavior

*   **Speed:** **1.2x** normal unit speed (moves as a solid block).
*   **Coordination:** The Legion maintains its 6-column grid while chasing the player.
*   **Physics:** 0.8 push force vs others, 0 internally. 
*   **Immunity:** Immune to **Fear**.

---

## 4. Implementation Refs

*   `legionSpawned`: Flag in `directorState` to ensure only one Legion per event window.
*   `activeLegionId`: Tracks the ID of the current Legion to end the event upon its destruction.
*   `EnemyLogic.ts` -> Handles the one-time bulk spawn and grid calculations.
