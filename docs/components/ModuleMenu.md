
# Module Menu Components

The Module Menu is the primary interface for the player's progression system, allowing them to equip Meteorites (Diamonds) and Legendary Hexes into slots. It has been refactored into a modular architecture.

## Component Architecture

### 1. ModuleMenu.tsx
The main container component.
- **Role**: Orchestrator and State Manager.
- **State**:
  - `movedItem`: Tracks Drag & Drop operations.
  - `hoveredItem` / `lockedItem`: Tracks tooltip display state.
- **Functions**:
  - Renders the `HexGrid` and `InventoryPanel`.
  - Handles the Ghost Item following the mouse cursor during drag.
  - Manages the Tooltip overlays (`MeteoriteTooltip`, `HexTooltip`).

### 2. HexGrid.tsx (`src/components/modules/HexGrid.tsx`)
Visualizes the central hex grid and diamond sockets.
- **Role**: Render the interactive game board for modules.
- **Features**:
  - **Hexagons**: Slots for Legendary Upgrades. Handles clicks and hovers.
  - **Diamonds**: Slots for Meteorite Stats. Handles Drag & Drop targets.
  - **Synergy Lines**: Visualizes connections (Resonance) between slots.
  - **Visuals**: Animated trails, glows, and pulses based on `GAME_CONFIG` or state.

### 3. InventoryPanel.tsx (`src/components/modules/InventoryPanel.tsx`)
Displays the player's collected items and recycling station.
- **Role**: Management of unequipped items.
- **Features**:
  - **Grid View**: Shows inventory items. Supports drag initiation.
  - **Recycler**: Drop zone to destroy items for Dust.
  - **Sorting/Filtering**: (Future extensibility).

### 4. ModuleUtils.ts
Helper functions for the module system.
- **Role**: Shared logic.
- **Functions**:
  - `getMeteoriteImage`: Returns asset path.
  - `getHexPoints`: Calculates SVG polygon points.
  - `findClosestVertices`: Math helper for drawing synergy lines between shapes.

## Interactions

- **Drag & Drop**:
  1. User clicks/drags an item in `InventoryPanel` or `HexGrid`.
  2. `ModuleMenu` sets `movedItem`.
  3. Ghost item follows cursor.
  4. User releases over a socket in `HexGrid`.
  5. `onSocketUpdate` is called to commit change.
- **Tooltips**:
  - Hovering an item triggers a tooltip in `ModuleMenu`.
  - Clicking an item "locks" the tooltip for detailed reading.
