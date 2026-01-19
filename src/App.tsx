import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { StatsMenu } from './components/StatsMenu';
import { SettingsMenu } from './components/SettingsMenu';
import { useGameLoop } from './hooks/useGame';

function App() {
  const hook = useGameLoop();
  // The original destructuring is removed as props are now accessed directly from 'hook'
  // const { gameState, upgradeChoices, handleUpgradeSelect, gameOver, resetGame, bossWarning } = hook;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <GameCanvas hook={hook} />

      {/* Overlays */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
        <HUD
          gameState={hook.gameState}
          upgradeChoices={hook.upgradeChoices}
          onUpgradeSelect={hook.handleUpgradeSelect}
          gameOver={hook.gameOver}
          onRestart={hook.restartGame}
          bossWarning={hook.bossWarning}
        />
      </div>

      {/* Stats Menu */}
      {hook.showStats && <StatsMenu gameState={hook.gameState} />}

      {/* Settings Menu */}
      {hook.showSettings && <SettingsMenu onClose={() => hook.setShowSettings(false)} onRestart={hook.restartGame} />}
    </div>
  );
}

export default App;
