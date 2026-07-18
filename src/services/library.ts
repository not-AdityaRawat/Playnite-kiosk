import { demoGames } from '../data/demoGames';
import type { Game } from '../types/game';

const isTauri = '__TAURI_INTERNALS__' in window;

export async function listGames(): Promise<Game[]> {
  if (!isTauri) return demoGames;

  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<Game[]>('list_games');
}

export async function launchGame(game: Game): Promise<void> {
  if (!isTauri) {
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    return;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('launch_game', { gameId: game.id });
}
