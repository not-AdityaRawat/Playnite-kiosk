import { create } from 'zustand';
import { listGames, launchGame } from '../services/library';
import type { Game, LaunchState } from '../types/game';

interface LibraryState {
  games: Game[];
  query: string;
  selectedId: string | null;
  loading: boolean;
  launchState: LaunchState;
  load: () => Promise<void>;
  setQuery: (query: string) => void;
  select: (id: string) => void;
  launch: (game: Game) => Promise<void>;
  clearLaunchState: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  games: [],
  query: '',
  selectedId: null,
  loading: true,
  launchState: { kind: 'idle' },
  load: async () => {
    try {
      const games = await listGames();
      set({ games, selectedId: games[0]?.id ?? null, loading: false });
    } catch {
      set({ games: [], loading: false });
    }
  },
  setQuery: (query) => set({ query }),
  select: (id) => set({ selectedId: id }),
  launch: async (game) => {
    set({ launchState: { kind: 'launching', game } });
    try {
      await launchGame(game);
      set({ launchState: { kind: 'running', game } });
    } catch (error) {
      set({ launchState: { kind: 'error', game, message: error instanceof Error ? error.message : 'Unable to start this game.' } });
    }
  },
  clearLaunchState: () => set({ launchState: { kind: 'idle' } }),
}));
