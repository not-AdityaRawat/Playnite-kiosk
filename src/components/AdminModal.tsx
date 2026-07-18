import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Check, KeyRound, LibraryBig, LogOut, ScrollText, ShieldCheck, Trash2, X } from 'lucide-react';
import { adminStatus, authenticateAdmin, changeAdminPassword, deleteManagedGame, discoverGames, enterAdminDebugMode, exitKiosk, exportConfiguration, getKioskMode, importConfiguration, initializeAdmin, listAdminLogs, listManagedGames, logoutAdmin, saveManagedGame, setKioskMode } from '../services/admin';
import type { AdminSession, ConfigurationExport, DiscoveryCandidate, GameInput, LogEntry, ManagedGame } from '../types/admin';
import type { LaunchMethod } from '../types/game';

type View = 'library' | 'security' | 'logs' | 'transfer';
type Gate = 'loading' | 'setup' | 'login' | 'panel';

const launchMethods: Array<{ value: LaunchMethod; label: string }> = [
  { value: 'direct_exe', label: 'Direct executable' },
  { value: 'steam_uri', label: 'Steam URI' },
  { value: 'epic_uri', label: 'Epic URI' },
  { value: 'ea_uri', label: 'EA URI' },
  { value: 'ubisoft_uri', label: 'Ubisoft URI' },
  { value: 'battlenet_uri', label: 'Battle.net URI' },
  { value: 'custom_command', label: 'Custom command' },
  { value: 'powershell_script', label: 'PowerShell script' },
  { value: 'batch_file', label: 'Batch file' },
];

const accentForName = (name: string) => {
  const palette = ['#d85b40', '#5b9f9a', '#dfca35', '#a6603b', '#637f99', '#b76a88', '#759c53', '#a575c7'];
  const hash = Array.from(name.trim().toLowerCase()).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0);
  return palette[hash % palette.length];
};

const blankGame = (): GameInput => ({ name: '', launchMethod: 'direct_exe', executable: '', workingDirectory: '', arguments: '', iconPath: '', processName: '', accent: '#75d7cb', sortOrder: 0, visible: true });

interface AdminModalProps {
  onClose: () => void;
  onLibraryChanged: () => Promise<void>;
}

export function AdminModal({ onClose, onLibraryChanged }: AdminModalProps) {
  const [gate, setGate] = useState<Gate>('loading');
  const [view, setView] = useState<View>('library');
  const [session, setSession] = useState<AdminSession | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [games, setGames] = useState<ManagedGame[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveryCandidate[]>([]);
  const [editingGame, setEditingGame] = useState<GameInput>(blankGame());
  const [kioskEnabled, setKioskEnabled] = useState(false);

  useEffect(() => {
    void adminStatus().then((status) => setGate(status.initialized ? 'login' : 'setup')).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Unable to open administrator access.');
      setGate('login');
    });
  }, []);

  const authenticated = gate === 'panel' && session !== null;

  async function openPanel(nextSession: AdminSession) {
    await enterAdminDebugMode(nextSession.token);
    const enabled = await getKioskMode(nextSession.token);
    setSession(nextSession);
    setKioskEnabled(enabled);
    setGate('panel');
    setMessage('');
    await refreshGames(nextSession.token);
  }

  async function submitGate(event: FormEvent) {
    event.preventDefault();
    if (gate === 'setup' && password !== confirmation) {
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const nextSession = gate === 'setup' ? await initializeAdmin(password) : await authenticateAdmin(password);
      setPassword('');
      setConfirmation('');
      await openPanel(nextSession);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Access was not granted.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshGames(token = session?.token) {
    if (!token) return;
    const records = await listManagedGames(token);
    setGames(records);
  }

  async function refreshLogs(token = session?.token) {
    if (!token) return;
    setLogs(await listAdminLogs(token));
  }

  async function saveGame(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setMessage('');
    try {
      await saveManagedGame(session.token, editingGame);
      await refreshGames();
      await onLibraryChanged();
      setEditingGame(blankGame());
      setMessage('Game saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this game.');
    } finally {
      setBusy(false);
    }
  }

  async function removeGame(game: ManagedGame) {
    if (!session || !window.confirm(`Remove ${game.name} from Playnite?`)) return;
    setBusy(true);
    try {
      await deleteManagedGame(session.token, game.id);
      await refreshGames();
      await onLibraryChanged();
      if (editingGame.id === game.id) setEditingGame(blankGame());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove this game.');
    } finally {
      setBusy(false);
    }
  }

  async function scanLocalGames() {
    if (!session) return;
    setBusy(true);
    try {
      const candidates = await discoverGames(session.token);
      setDiscovered(candidates);
      setMessage(candidates.length ? `${candidates.length} local games found for review.` : 'No supported local installations found.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to scan local installations.');
    } finally {
      setBusy(false);
    }
  }

  async function closePanel() {
    if (session) {
      try { await logoutAdmin(session.token); } catch { /* Session expiry is safe to ignore while closing. */ }
    }
    onClose();
  }

  async function updateKioskMode(enabled: boolean) {
    if (!session) return;
    setBusy(true);
    try {
      await setKioskMode(session.token, enabled);
      setKioskEnabled(enabled);
      setMessage(enabled ? 'Close protection will apply when administrator access is locked.' : 'Close protection will remain disabled when administrator access is locked.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update kiosk restrictions.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-backdrop" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true" aria-label="Playnite administrator access">
        <header className="admin-modal__header">
          <div><span className="admin-eyebrow">Playnite</span><h2>Administrator</h2></div>
          <button className="icon-button" type="button" onClick={() => void closePanel()} aria-label="Close administrator panel"><X size={20} /></button>
        </header>

        {gate === 'loading' && <div className="admin-empty">Preparing secure access</div>}
        {(gate === 'setup' || gate === 'login') && (
          <form className="access-form" onSubmit={submitGate}>
            <ShieldCheck size={31} aria-hidden="true" />
            <h3>{gate === 'setup' ? 'Set administrator password' : 'Administrator password'}</h3>
            {gate === 'setup' && <p>Set this before assigning the kiosk to players. It is stored only as an Argon2id hash.</p>}
            <label>Password<input type="password" value={password} minLength={12} autoFocus autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} /></label>
            {gate === 'setup' && <label>Confirm password<input type="password" value={confirmation} minLength={12} autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} /></label>}
            {message && <p className="form-message" role="alert">{message}</p>}
            <button className="command-button" type="submit" disabled={busy}>{gate === 'setup' ? 'Secure administrator access' : 'Unlock controls'}</button>
          </form>
        )}

        {authenticated && session && (
          <div className="admin-layout">
            <nav className="admin-nav" aria-label="Administrator sections">
              <button className={view === 'library' ? 'is-active' : ''} type="button" onClick={() => setView('library')}><LibraryBig size={18} />Library</button>
              <button className={view === 'security' ? 'is-active' : ''} type="button" onClick={() => setView('security')}><KeyRound size={18} />Security</button>
              <button className={view === 'transfer' ? 'is-active' : ''} type="button" onClick={() => setView('transfer')}><ArrowDownUp size={18} />Transfer</button>
              <button className={view === 'logs' ? 'is-active' : ''} type="button" onClick={() => { setView('logs'); void refreshLogs(); }}><ScrollText size={18} />Logs</button>
              <button type="button" onClick={() => void closePanel()}><LogOut size={18} />Lock admin</button>
            </nav>
            <div className="admin-content">
              {message && <p className="form-message" role="status">{message}</p>}
              {view === 'library' && <LibraryAdmin games={games} discovered={discovered} value={editingGame} busy={busy} onScan={() => void scanLocalGames()} onChange={setEditingGame} onSubmit={saveGame} onEdit={(game) => setEditingGame({ ...game })} onDelete={removeGame} />}
              {view === 'security' && <SecurityAdmin session={session} kioskEnabled={kioskEnabled} onKioskChange={(enabled) => void updateKioskMode(enabled)} onMessage={setMessage} onExit={() => void exitKiosk(session.token)} />}
              {view === 'transfer' && <TransferAdmin session={session} onMessage={setMessage} onLibraryChanged={onLibraryChanged} />}
              {view === 'logs' && <LogsAdmin logs={logs} />}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function TransferAdmin({ session, onMessage, onLibraryChanged }: { session: AdminSession; onMessage: (message: string) => void; onLibraryChanged: () => Promise<void> }) {
  const [payload, setPayload] = useState('');
  const [busy, setBusy] = useState(false);
  async function createExport() {
    setBusy(true);
    try { setPayload(JSON.stringify(await exportConfiguration(session.token), null, 2)); onMessage('Configuration exported without credentials.'); }
    catch (error) { onMessage(error instanceof Error ? error.message : 'Unable to export configuration.'); }
    finally { setBusy(false); }
  }
  async function applyImport() {
    setBusy(true);
    try {
      const configuration = JSON.parse(payload) as ConfigurationExport;
      await importConfiguration(session.token, configuration);
      await onLibraryChanged();
      onMessage('Configuration imported.');
    } catch (error) { onMessage(error instanceof Error ? error.message : 'Invalid configuration.'); }
    finally { setBusy(false); }
  }
  return <div className="transfer-admin"><div className="admin-section-title"><div><h3>Configuration transfer</h3><p>Credentials and active sessions are never included.</p></div></div><textarea value={payload} onChange={(event) => setPayload(event.target.value)} aria-label="Configuration JSON" spellCheck={false} /><div className="transfer-admin__actions"><button className="secondary-button" type="button" onClick={() => void createExport()} disabled={busy}>Create export</button><button className="command-button" type="button" onClick={() => void applyImport()} disabled={busy || !payload.trim()}>Import configuration</button></div></div>;
}

function LibraryAdmin({ games, discovered, value, busy, onScan, onChange, onSubmit, onEdit, onDelete }: { games: ManagedGame[]; discovered: DiscoveryCandidate[]; value: GameInput; busy: boolean; onScan: () => void; onChange: (value: GameInput) => void; onSubmit: (event: FormEvent) => void; onEdit: (game: ManagedGame) => void; onDelete: (game: ManagedGame) => void }) {
  const formTitle = value.id ? 'Edit game' : 'Add game';
  return <div className="admin-library">
    <div className="admin-section-title"><div><h3>Library</h3><p>{games.length} configured games</p></div><div className="admin-section-actions"><button className="secondary-button" type="button" onClick={onScan} disabled={busy}>Scan local installs</button><button className="secondary-button" type="button" onClick={() => onChange(blankGame())}>New game</button></div></div>
    <div className="admin-library__grid">
      <div className="managed-games">{games.length === 0 ? <p className="admin-empty">No games configured.</p> : games.map((game) => <div className="managed-game" key={game.id}><button type="button" onClick={() => onEdit({ ...game })}><span className="managed-game__accent" style={{ background: game.accent }} /><span><strong>{game.name}</strong><small>{game.visible ? game.launchMethod : 'Hidden'}</small></span></button><button className="icon-button" type="button" onClick={() => onDelete(game)} aria-label={`Remove ${game.name}`}><Trash2 size={17} /></button></div>)}{discovered.length > 0 && <div className="discovery-list"><h4>Detected locally</h4>{discovered.map((candidate, index) => <button type="button" key={`${candidate.source}-${candidate.game.name}-${index}`} onClick={() => onChange({ ...candidate.game, accent: accentForName(candidate.game.name) })}><strong>{candidate.game.name}</strong><small>{candidate.source}</small></button>)}</div>}</div>
      <form className="game-editor" onSubmit={onSubmit}>
        <h4>{formTitle}</h4>
        <label>Name<input value={value.name} onChange={(event) => { const name = event.target.value; onChange({ ...value, name, accent: value.id ? value.accent : accentForName(name) }); }} maxLength={160} required /></label>
        <label>Launch method<select value={value.launchMethod} onChange={(event) => onChange({ ...value, launchMethod: event.target.value as LaunchMethod })}>{launchMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
        <label>Launch target<input value={value.executable} onChange={(event) => onChange({ ...value, executable: event.target.value })} maxLength={2048} required /></label>
        <label>Working directory<input value={value.workingDirectory ?? ''} onChange={(event) => onChange({ ...value, workingDirectory: event.target.value })} maxLength={2048} /></label>
        <label>Arguments<input value={value.arguments ?? ''} onChange={(event) => onChange({ ...value, arguments: event.target.value })} maxLength={4096} /></label>
        <label>Game process name<input value={value.processName ?? ''} onChange={(event) => onChange({ ...value, processName: event.target.value })} maxLength={255} placeholder="ExampleGame.exe" /></label>
        <div className="two-fields"><div className="color-preview"><span style={{ background: value.accent }} aria-hidden="true" /><small>Library color</small></div><label>Sort order<input type="number" value={value.sortOrder} onChange={(event) => onChange({ ...value, sortOrder: Number(event.target.value) })} /></label></div>
        <label className="checkbox-field"><input type="checkbox" checked={value.visible} onChange={(event) => onChange({ ...value, visible: event.target.checked })} />Visible in library</label>
        <button className="command-button" type="submit" disabled={busy}><Check size={17} />Save game</button>
      </form>
    </div>
  </div>;
}

function SecurityAdmin({ session, kioskEnabled, onKioskChange, onMessage, onExit }: { session: AdminSession; kioskEnabled: boolean; onKioskChange: (enabled: boolean) => void; onMessage: (message: string) => void; onExit: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (nextPassword !== confirmation) { onMessage('New passwords do not match.'); return; }
    setBusy(true);
    try { await changeAdminPassword(session.token, currentPassword, nextPassword); setCurrentPassword(''); setNextPassword(''); setConfirmation(''); onMessage('Administrator password changed.'); }
    catch (error) { onMessage(error instanceof Error ? error.message : 'Unable to change password.'); }
    finally { setBusy(false); }
  }
  return <div className="security-admin"><div className="admin-section-title"><div><h3>Security</h3><p>Administrator sessions expire after 15 minutes of inactivity.</p></div></div><div className="kiosk-setting"><div><h4>Kiosk close protection</h4><p>Prevent closing Playnite through its window controls after admin access is locked.</p></div><label className="toggle-switch"><input type="checkbox" checked={kioskEnabled} onChange={(event) => onKioskChange(event.target.checked)} /><span aria-hidden="true" /></label></div><form className="password-form" onSubmit={submit}><label>Current password<input type="password" value={currentPassword} autoComplete="current-password" onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label>New password<input type="password" value={nextPassword} minLength={12} autoComplete="new-password" onChange={(event) => setNextPassword(event.target.value)} required /></label><label>Confirm new password<input type="password" value={confirmation} minLength={12} autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required /></label><button className="command-button" type="submit" disabled={busy}>Change password</button></form><div className="danger-zone"><h4>Exit Playnite</h4><p>Closes Playnite and returns control to the Windows shell configured for this account.</p><button className="danger-button" type="button" onClick={onExit}>Exit Playnite</button></div></div>;
}

function LogsAdmin({ logs }: { logs: LogEntry[] }) {
  const rows = useMemo(() => logs, [logs]);
  return <div className="logs-admin"><div className="admin-section-title"><div><h3>Audit log</h3><p>Most recent 100 administrative and launch events.</p></div></div>{rows.length === 0 ? <p className="admin-empty">No events recorded.</p> : <div className="log-table">{rows.map((record, index) => <div key={`${record.createdAt}-${index}`}><time>{record.createdAt}</time><span>{record.level}</span><strong>{record.event}</strong><small>{record.details ?? ''}</small></div>)}</div>}</div>;
}
