import { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { StatsMenu } from './components/StatsMenu';
import { SettingsMenu } from './components/SettingsMenu';
import { MainMenu } from './components/MainMenu';
import { DeathScreen } from './components/DeathScreen';
import { useGameLoop } from './hooks/useGame';
import { startBGM } from './logic/AudioLogic';
import './styles/menu_additions.css';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const hook = useGameLoop(gameStarted);

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
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {!gameStarted && <MainMenu onStart={handleStart} />}

      {gameStarted && (
        <>
          <GameCanvas hook={hook} />

          {/* Overlays */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            <HUD
              gameState={hook.gameState}
              upgradeChoices={hook.upgradeChoices}
              onUpgradeSelect={hook.handleUpgradeSelect}
              bossWarning={hook.bossWarning}
            />
          </div>

          {/* Stats Menu */}
          {hook.showStats && <StatsMenu gameState={hook.gameState} />}

          {/* Settings Menu */}
          {hook.showSettings && <SettingsMenu onClose={() => hook.setShowSettings(false)} onRestart={hook.restartGame} onQuit={handleQuit} />}

          {/* Death Screen */}
          {hook.gameOver && (
            <DeathScreen
              stats={{
                time: hook.gameState.gameTime,
                kills: hook.gameState.killCount,
                bosses: 0, // Need to track bosses
                level: hook.gameState.player.level,
              }}
              gameState={hook.gameState}
              onRestart={hook.restartGame}
              onQuit={handleQuit}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
