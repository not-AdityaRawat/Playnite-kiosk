import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gamepad2, Search } from 'lucide-react';
import { GameCard } from './components/GameCard';
import { LaunchOverlay } from './components/LaunchOverlay';
import { AdminModal } from './components/AdminModal';
import { useLibraryStore } from './store/useLibraryStore';

export default function App() {
  const { games, query, selectedId, loading, load, setQuery, select, launch, clearLaunchState, launchState } = useLibraryStore();
  const [adminOpen, setAdminOpen] = useState(false);
  const visibleGames = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return games.filter((game) => game.visible && game.name.toLocaleLowerCase().includes(normalizedQuery));
  }, [games, query]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(({ listen }) => listen('game-session-ended', () => clearLaunchState()).then((stop) => { unlisten = stop; }));
    return () => { unlisten?.(); };
  }, [clearLaunchState]);

  const moveSelection = useCallback((direction: 'next' | 'previous') => {
    if (visibleGames.length === 0) return;
    const currentIndex = visibleGames.findIndex((game) => game.id === selectedId);
    const offset = direction === 'next' ? 1 : -1;
    const nextIndex = (Math.max(currentIndex, 0) + offset + visibleGames.length) % visibleGames.length;
    select(visibleGames[nextIndex].id);
  }, [selectedId, select, visibleGames]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'F12') {
        event.preventDefault();
        setAdminOpen(true);
        return;
      }
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection('next');
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection('previous');
      }
      if (event.key === 'Enter') {
        const selectedGame = visibleGames.find((game) => game.id === selectedId);
        if (selectedGame) {
          const state = useLibraryStore.getState();
          if (state.launchState.kind === 'running' && state.launchState.game.id === selectedGame.id) {
            void state.resume(selectedGame);
          } else {
            void launch(selectedGame);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [launch, moveSelection, selectedId, visibleGames]);

  useGamepadNavigation(() => moveSelection('previous'), () => moveSelection('next'), () => {
    const selectedGame = visibleGames.find((game) => game.id === selectedId);
    if (selectedGame) {
      const state = useLibraryStore.getState();
      if (state.launchState.kind === 'running' && state.launchState.game.id === selectedGame.id) {
        void state.resume(selectedGame);
      } else {
        void launch(selectedGame);
      }
    }
  });

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="Playnite">
          <Gamepad2 size={25} strokeWidth={2.3} aria-hidden="true" />
          <span>Playnite</span>
        </div>
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" aria-label="Search games" autoComplete="off" />
        </label>
      </header>

      <section className="library" aria-label="Installed games">
        <div className="library__heading">
          <p>Your library</p>
          <span>{visibleGames.length} games</span>
        </div>
        {loading ? <div className="empty-state">Loading library</div> : visibleGames.length === 0 ? <div className="empty-state">No games found</div> : (
          <div className="game-grid">
            {visibleGames.map((game) => {
              const isRunning = launchState.kind === 'running' && launchState.game.id === game.id;
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  selected={game.id === selectedId}
                  isRunning={isRunning}
                  onSelect={() => select(game.id)}
                  onLaunch={() => void launch(game)}
                  onResume={() => void useLibraryStore.getState().resume(game)}
                />
              );
            })}
          </div>
        )}
      </section>
      <footer className="app-footer">Use the controller or select a game to play</footer>
      <LaunchOverlay />
      {adminOpen && <AdminModal onClose={() => setAdminOpen(false)} onLibraryChanged={load} />}
    </main>
  );
}

function useGamepadNavigation(previous: () => void, next: () => void, confirm: () => void) {
  const heldInputs = useRef(new Map<string, number>());

  useEffect(() => {
    let frameId = 0;
    const poll = () => {
      const now = performance.now();
      for (const controller of navigator.getGamepads()) {
        if (!controller) continue;
        
        // Define digital button bindings
        const bindings: Array<[number, () => void]> = [
          [12, previous], [14, previous], // D-pad Up, Left
          [13, next], [15, next],         // D-pad Down, Right
          [0, confirm]                    // A Button
        ];

        // Combine inputs into a generic array of active commands
        const activeCommands: Array<{ key: string, action: () => void, isAxis?: boolean }> = [];
        
        for (const [buttonIndex, action] of bindings) {
          if (controller.buttons[buttonIndex]?.pressed) {
            activeCommands.push({ key: `btn_${controller.index}_${buttonIndex}`, action });
          }
        }

        // Add Left Stick (Axes 0 and 1)
        const deadzone = 0.5;
        const lsX = controller.axes[0] ?? 0;
        const lsY = controller.axes[1] ?? 0;
        
        if (lsX < -deadzone || lsY < -deadzone) {
          activeCommands.push({ key: `axis_${controller.index}_prev`, action: previous, isAxis: true });
        }
        if (lsX > deadzone || lsY > deadzone) {
          activeCommands.push({ key: `axis_${controller.index}_next`, action: next, isAxis: true });
        }

        // Process active commands for repeat logic
        const currentActiveKeys = new Set<string>();
        
        for (const { key, action, isAxis } of activeCommands) {
          currentActiveKeys.add(key);
          const lastTriggered = heldInputs.current.get(key);
          
          if (lastTriggered === undefined) {
            // First press
            action();
            heldInputs.current.set(key, now + 300); // Wait 300ms before repeating
          } else if (now > lastTriggered) {
            // Repeat
            action();
            // Axis inputs repeat faster because they feel slower when held
            heldInputs.current.set(key, now + (isAxis ? 100 : 120));
          }
        }

        // Clean up released inputs
        for (const key of heldInputs.current.keys()) {
          if (!currentActiveKeys.has(key)) {
            heldInputs.current.delete(key);
          }
        }
      }
      frameId = window.requestAnimationFrame(poll);
    };
    frameId = window.requestAnimationFrame(poll);
    return () => window.cancelAnimationFrame(frameId);
  }, [previous, next, confirm]);
}
