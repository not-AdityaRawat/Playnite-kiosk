export type LaunchMethod =
  | 'direct_exe'
  | 'steam_uri'
  | 'epic_uri'
  | 'ea_uri'
  | 'ubisoft_uri'
  | 'battlenet_uri'
  | 'custom_command'
  | 'powershell_script'
  | 'batch_file';

export interface Game {
  id: string;
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

export type LaunchState =
  | { kind: 'idle' }
  | { kind: 'launching'; game: Game }
  | { kind: 'running'; game: Game }
  | { kind: 'error'; game: Game; message: string };
