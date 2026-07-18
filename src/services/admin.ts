import type { AdminSession, AdminStatus, ConfigurationExport, DiscoveryCandidate, GameInput, LogEntry, ManagedGame } from '../types/admin';

const isTauri = '__TAURI_INTERNALS__' in window;

async function invoke<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  if (!isTauri) throw new Error('Administrator controls are available in the installed Playnite application.');
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, payload);
}

export const adminStatus = () => invoke<AdminStatus>('admin_status');
export const initializeAdmin = (password: string) => invoke<AdminSession>('initialize_admin', { password });
export const authenticateAdmin = (password: string) => invoke<AdminSession>('authenticate_admin', { password });
export const enterAdminDebugMode = (sessionToken: string) => invoke<void>('enter_admin_debug_mode', { sessionToken });
export const getKioskMode = (sessionToken: string) => invoke<boolean>('admin_get_kiosk_mode', { sessionToken });
export const setKioskMode = (sessionToken: string, enabled: boolean) => invoke<void>('admin_set_kiosk_mode', { sessionToken, enabled });
export const logoutAdmin = (sessionToken: string) => invoke<void>('logout_admin', { sessionToken });
export const changeAdminPassword = (sessionToken: string, currentPassword: string, newPassword: string) => invoke<void>('change_admin_password', { sessionToken, currentPassword, newPassword });
export const listManagedGames = (sessionToken: string) => invoke<ManagedGame[]>('admin_list_games', { sessionToken });
export const saveManagedGame = (sessionToken: string, game: GameInput) => invoke<ManagedGame>('admin_save_game', { sessionToken, game });
export const deleteManagedGame = (sessionToken: string, gameId: string) => invoke<void>('admin_delete_game', { sessionToken, gameId });
export const listAdminLogs = (sessionToken: string) => invoke<LogEntry[]>('admin_list_logs', { sessionToken });
export const exportConfiguration = (sessionToken: string) => invoke<ConfigurationExport>('admin_export_configuration', { sessionToken });
export const importConfiguration = (sessionToken: string, configuration: ConfigurationExport) => invoke<void>('admin_import_configuration', { sessionToken, configuration });
export const discoverGames = (sessionToken: string) => invoke<DiscoveryCandidate[]>('admin_discover_games', { sessionToken });
export const exitKiosk = (sessionToken: string) => invoke<void>('exit_kiosk', { sessionToken });
