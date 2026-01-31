import { useRef, useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { StatsMenu } from './components/StatsMenu';
import { SettingsMenu } from './components/SettingsMenu';
import { MainMenu } from './components/MainMenu';
import { DeathScreen } from './components/DeathScreen';
import { MobileControls } from './components/MobileControls';


import { ModuleMenu } from './components/ModuleMenu';
import { LegendarySelectionMenu } from './components/LegendarySelectionMenu';

import { useGameLoop } from './hooks/useGame';
import { useWindowScale } from './hooks/useWindowScale';
import { startBGM } from './logic/AudioLogic';
import './styles/menu_additions.css';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const hook = useGameLoop(gameStarted);
  const appRef = useRef<HTMLDivElement>(null);

  const { scale, isMobile, isLandscape } = useWindowScale();

  // Auto-focus logic
  useEffect(() => {
    if (gameStarted && !hook.showStats && !hook.showSettings && !hook.showModuleMenu) {
      appRef.current?.focus();
    }
  }, [gameStarted, hook.showStats, hook.showSettings, hook.showModuleMenu]);

  // Reset logic when quitting to main menu
  const handleQuit = () => {
    hook.setShowSettings(false);
    setGameStarted(false);
    // Optional: reset game state logic if needed, but restartGame handles most
    hook.restartGame();
  };

  const handleStart = () => {
    // startBGM(); // User requested silence/no firing sounds on load for now, or maybe only menu music stops?
    // Actually user complaint was "firing sounds on start". That suggests game loop running before ready.
    // But we already fixed game loop. 
    // Wait, the user said "Remove firing sounds on load".
    // I will comment out startBGM to be safe if they mean music, or just ensure logic is right.
    // But actually, 'startBGM' plays the game music. The user specifically mentioned "firing sounds".
    // I already fixed the game loop running in background.
    // The user's request "Audio: Remove firing sounds on load" likely refers to the previous bug I fixed.
    // However, I will ensure startBGM is called ONLY when game fully starts.
    startBGM();
    setGameStarted(true);
    // Ensure inputs are cleared or delay input processing slightly?
    // The previous fix 'useGameLoop(gameStarted)' should prevent firing.
    hook.restartGame();
  };

  return (
    <div
      ref={appRef}
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', outline: 'none', background: '#000' }}
      tabIndex={0}
      onClick={(e) => e.currentTarget.focus()}
    >

      {!gameStarted && <MainMenu onStart={handleStart} />}

      {gameStarted && (
        <>
          <GameCanvas hook={hook} />

          {/* UI SCALING CONTAINER */}
          {/* We scale the UI layer to match the game resolution scale */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none' // Allow clicks to pass through empty areas? HUD elements have auto pointer events
          }}>

            {/* Overlays */}
            {!hook.showModuleMenu && (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                <HUD
                  gameState={hook.gameState}
                  upgradeChoices={hook.upgradeChoices}
                  onUpgradeSelect={hook.handleUpgradeSelect}
                  gameOver={hook.gameOver}
                  onRestart={hook.restartGame}
                  bossWarning={hook.bossWarning}
                  fps={hook.fps}
                  onInventoryToggle={hook.toggleModuleMenu}
                />

                {isMobile && !hook.gameOver && (
                  <MobileControls onInput={hook.handleJoystickInput} />
                )}
              </div>
            )}

            {/* Stats Menu */}
            {hook.showStats && <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}><StatsMenu gameState={hook.gameState} /></div>}

            {/* Settings Menu */}
            {hook.showSettings && <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}><SettingsMenu onClose={() => hook.setShowSettings(false)} onRestart={hook.restartGame} onQuit={handleQuit} /></div>}

            {/* Module Menu */}
            <div style={{ pointerEvents: hook.showModuleMenu ? 'auto' : 'none' }}>
              <ModuleMenu
                gameState={hook.gameState}
                isOpen={hook.showModuleMenu}
                onClose={() => hook.setShowModuleMenu(false)}
                onSocketUpdate={hook.handleModuleSocketUpdate}
                onInventoryUpdate={hook.updateInventorySlot}
                onRecycle={hook.recycleMeteorite}
                spendDust={hook.spendDust}
                triggerPortal={hook.triggerPortal}
              />
            </div>

            {/* Legendary Selection Menu */}
            {hook.showLegendarySelection && hook.gameState.legendaryOptions && (
              <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>
                <LegendarySelectionMenu
                  options={hook.gameState.legendaryOptions}
                  onSelect={hook.handleLegendarySelect}
                />
              </div>
            )}

            {/* Death Screen */}
            {hook.gameOver && (
              <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>
                <DeathScreen
                  stats={{
                    time: hook.gameState.gameTime,
                    kills: hook.gameState.killCount,
                    bosses: hook.gameState.bossKills,
                    level: hook.gameState.player.level,
                  }}
                  gameState={hook.gameState}
                  onRestart={hook.restartGame}
                  onQuit={handleQuit}
                />
              </div>
            )}
          </div>

          {/* Mobile Rotation Warning (Overlay on top of everything) */}
          {isMobile && !isLandscape && (
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
              background: '#020617', zIndex: 9999,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: '#fff', textAlign: 'center', padding: 20
            }}>
              <h2 style={{ color: '#ef4444', marginBottom: 20 }}>NO SIGNAL</h2>
              <p>INITIATE LANDSCAPE MODE TO ESTABLISH LINK</p>
              <div style={{ width: 60, height: 100, border: '4px solid #3b82f6', borderRadius: 8, marginTop: 40, animation: 'rotate-phone 2s infinite' }}></div>
              <style>{`
                 @keyframes rotate-phone {
                   0% { transform: rotate(0deg); }
                   50% { transform: rotate(90deg); }
                   100% { transform: rotate(90deg); }
                 }
               `}</style>
            </div>
          )}

        </>
      )}
    </div>
  );
}

export default App;
