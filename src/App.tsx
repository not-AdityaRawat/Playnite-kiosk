import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gamepad2, Search } from 'lucide-react';
import { GameCard } from './components/GameCard';
import { LaunchOverlay } from './components/LaunchOverlay';
import { AdminModal } from './components/AdminModal';
import { useLibraryStore } from './store/useLibraryStore';

export default function App() {
  const { games, query, selectedId, loading, load, setQuery, select, launch, clearLaunchState } = useLibraryStore();
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
  const heldButtons = useRef(new Set<number>());

  useEffect(() => {
    let frameId = 0;
    const poll = () => {
      for (const controller of navigator.getGamepads()) {
        if (!controller) continue;
        const bindings: Array<[number, () => void]> = [[12, previous], [14, previous], [13, next], [15, next], [0, confirm]];
        for (const [buttonIndex, action] of bindings) {
          const pressed = controller.buttons[buttonIndex]?.pressed ?? false;
          const key = controller.index * 100 + buttonIndex;
          if (pressed && !heldButtons.current.has(key)) {
            heldButtons.current.add(key);
            action();
          }
          if (!pressed) heldButtons.current.delete(key);
        }
      }
      frameId = window.requestAnimationFrame(poll);
    };
    frameId = window.requestAnimationFrame(poll);
    return () => window.cancelAnimationFrame(frameId);
  }, [confirm, next, previous]);
}
