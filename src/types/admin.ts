import type { Game, LaunchMethod } from './game';

export interface AdminStatus {
  initialized: boolean;
}

export interface AdminSession {
  token: string;
  expiresInSeconds: number;
}

export interface GameInput {
  id?: string;
  name: string;
  launchMethod: LaunchMethod;
  executable: string;
  workingDirectory?: string;
  arguments?: string;
  iconPath?: string;
  processName?: string;
  accent: string;
  sortOrder: number;
  visible: boolean;
}

export interface LogEntry {
  createdAt: string;
  level: string;
  event: string;
  details?: string;
}

export interface ConfigurationExport {
  schemaVersion: number;
  games: GameInput[];
}

export interface DiscoveryCandidate {
  source: string;
  game: GameInput;
}

export type ManagedGame = Game;
