
# HUD Components

The Heads-Up Display (HUD) provides vital information to the player during gameplay. It is built as a composite of specialized panels to keep the code organized and manageable.

## Component Architecture

### 1. HUD.tsx
The layout composer.
- **Role**: Positions and renders the sub-panels. Do not put complex logic here.
- **Input**: Receives `GameState` and passes relevant slices to children.
- **Visuals**: Draws the global XP bar (could be moved to TopBar in future).

### 2. PlayerStatus.tsx (`src/components/hud/PlayerStatus.tsx`)
The bottom-center status cluster.
- **Displays**:
  - **HP Bar**: Health visualization.
  - **Shield Bar**: Shield chunks overlay.
  - **Skill Bar**: Active skill icons, cooldowns, and keybinds.
  - **Casting Bar**: For channelled skills like Epicenter.
  - **Passive Indicators**: For stacking buffs (e.g., Sonic Wave).

### 3. TopLeftPanel.tsx (`src/components/hud/TopLeftPanel.tsx`)
Top-left stats and buffs.
- **Displays**:
  - Score (Kills).
  - Player Level.
  - Game Time.
  - **Arena Buffs**: Pulsing indicators for current Hex Arena effects (Econ/Combat/Defense).
  - **Stun Warning**: Visual feedback when player engines are disabled.

### 4. BottomRightPanel.tsx (`src/components/hud/BottomRightPanel.tsx`)
System and Inventory toggles.
- **Displays**:
  - FPS Counter.
  - Inventory Button (with "New Items" badge).

### 5. AlertPanel.tsx (`src/components/hud/AlertPanel.tsx`)
Center-right / Full-screen alerts.
- **Displays**:
  - Boss Warnings ("ANOMALY DETECTED").
  - Rare Enemy Warnings ("Snitch").
  - Portal Timer/State notifications.

### 6. BossStatus.tsx (`src/components/hud/BossStatus.tsx`)
Top-center boss information.
- **Displays**:
  - Boss HP Bar (only when boss is active).
  - Current Sector Name.

### 7. UpgradeMenu.tsx (`src/components/hud/UpgradeMenu.tsx`)
The level-up selection overlay.
- **Role**: Intercepts input to allow selecting perks.
- **Visuals**: Renders `UpgradeCard` components in a stylized container.

## Styling
HUD components use a mix of inline styles and global CSS (mainly for animations like `pulse`, `glitch-text`).
- **Colors**: Uses a consistent palette (Cyan for Econ/UI, Red for Danger/Combat, Blue for Shield/Defense).
