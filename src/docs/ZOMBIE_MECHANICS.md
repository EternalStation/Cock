# Friendly Zombie Mechanics (Crimson Feast)

## Overview
Zombies are friendly units spawned by the **Crimson Feast** (ComLife) Legendary Hex. They act as suicide units that latch onto enemies, disabling them and consuming them, or dealing significant damage to Bosses.

## Life Cycle
1.  **Spawn**: Zombies spawn from the corpses of fallen enemies (10% chance with ComLife Lvl 4+ or during Necrotic Surge).
2.  **Rising**: They spend 1.5s in a "rising" state (invulnerable/inactive) before becoming **Active**.
3.  **Hearts**: A Zombie has **3 Hearts** (Lives).
    *   **Taking Damage**: If a Zombie collides with a non-target enemy or is hit while eating, it loses **1 Heart**.
    *   **Death**: When Hearts reach 0, the Zombie dies permanently.

## Behavior States

### 1. Active (Hunting)
*   **Targeting**: The Zombie targets the **NEAREST** non-friendly enemy (Normal, Elite, or Boss).
*   **Movement**: Moves rapidly towards the target. Speed increases if the player is in danger (Enraged).
*   **Collision (Obstacles)**:
    *   If the Zombie collides with an enemy *other* than its target while moving, it loses **1 Heart** and bounces off.

### 2. Clinging (Eating)
When the Zombie captures its target, it enters the **Clinging** state. The effect depends on the target type:

#### A. Normal Enemies
*   **Control**: The enemy is **DISABLED** (Frozen, cannot move or shoot).
*   **Duration**: **3 Seconds**.
*   **Result**: 
    1.  The enemy dies instantly.
    2.  The Zombie loses **1 Heart**.
    3.  If the Zombie survives (has hearts left), it returns to **Active** state to hunt again.

#### B. Elite Enemies
*   **Control**: The enemy is **DISABLED** (Frozen).
*   **Duration**: **5 Seconds**.
*   **Result**:
    1.  The Elite enemy dies instantly.
    2.  The Zombie loses **3 Hearts** (Instant Death). It sacrifices itself to consume the Elite.

#### C. Bosses
*   **Control**: The Boss is **NOT DISABLED**. It continues to move and attack.
*   **Duration**: **5 Seconds**.
*   **Damage**: The Zombie deals **2% of the Boss's Max HP per second**.
*   **Result**:
    1.  After 5 seconds, the Zombie loses **3 Hearts** (Instant Death).

## Disruption (Interruption)
*   If *another* enemy touches the Zombie while it is eating/clinging:
    *   The Zombie takes damage (**-1 Heart**).
    *   If the Zombie dies from this damage, the eating process is aborted, and the target is released (if it was disabled).
