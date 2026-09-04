import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import {
  Download, Upload, AlertTriangle, CheckCircle2, Wifi, WifiOff,
  FileSpreadsheet, FolderOpen, ShieldCheck, Clock, History,
  RefreshCw, Trash2, HardDrive,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';
import { exportToExcel, importFromExcel } from '../api/excelBackup';
import {
  supportsFileSystemAccess,
  loadDirectoryHandle,
  saveDirectoryHandle,
  clearDirectoryHandle,
  verifyPermission,
  writeBackupToFolder,
  triggerDownloadBackup,
  getLastBackupTime,
  loadBackupHistory,
  clearBackupHistory,
  type BackupHistoryEntry,
} from '../api/autoBackup';

// ─── Small helpers ────────────────────────────────────────────────────────────
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const settings         = useAppStore((s) => s.settings);
  const updateSettings   = useAppStore((s) => s.updateSettings);
  const loadLocalData    = useAppStore((s) => s.loadLocalData);
  const connectionStatus = useAppStore((s) => s.connectionStatus);

  const [formState, setFormState] = useState(settings);
  const [isDirty,   setIsDirty]   = useState(false);

  // ── Export / Import ─────────────────────────────────────────────────────────
  const [exportStatus,  setExportStatus]  = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [importStatus,  setImportStatus]  = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [importCounts,  setImportCounts]  = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto Backup state ───────────────────────────────────────────────────────
  const [folderName,     setFolderName]     = useState<string | null>(null);
  const [backupStatus,   setBackupStatus]   = useState<'idle' | 'working' | 'done' | 'error' | 'no-permission'>('idle');
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(getLastBackupTime());
  const [history,        setHistory]        = useState<BackupHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    const h = await loadBackupHistory();
    setHistory(h);
    setHistoryLoading(false);
  }, []);

  // Load saved folder name + history on mount
  useEffect(() => {
    loadDirectoryHandle().then(async (handle) => {
      if (!handle) return;
      const ok = await verifyPermission(handle, 'read');
      setFolderName(ok ? handle.name : null);
      if (!ok) await clearDirectoryHandle();
    });
    void refreshHistory();
  }, [refreshHistory]);

  const handleChooseFolder = async () => {
    if (!supportsFileSystemAccess) return;
    try {
      const handle = await (window as unknown as {
        showDirectoryPicker(opts?: { mode?: string }): Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker({ mode: 'readwrite' });
      await saveDirectoryHandle(handle);
      setFolderName(handle.name);
      setBackupStatus('idle');
    } catch {
      // User cancelled — do nothing
    }
  };

  const handleRemoveFolder = async () => {
    await clearDirectoryHandle();
    setFolderName(null);
    setBackupStatus('idle');
  };

  const handleBackupNow = async () => {
    setBackupStatus('working');
    try {
      const handle = await loadDirectoryHandle();
      if (handle) {
        const filename = await writeBackupToFolder();
        if (filename) {
          setLastBackupTime(new Date().toISOString());
          setBackupStatus('done');
          await refreshHistory();
        } else {
          setBackupStatus('no-permission');
        }
      } else {
        // No folder configured — fall back to browser download
        await triggerDownloadBackup();
        setLastBackupTime(new Date().toISOString());
        setBackupStatus('done');
        await refreshHistory();
      }
    } catch {
      setBackupStatus('error');
    }
    setTimeout(() => setBackupStatus('idle'), 5000);
  };

  const handleClearHistory = async () => {
    await clearBackupHistory();
    setHistory([]);
  };

  // ── Field groups ────────────────────────────────────────────────────────────
  const fieldGroups = useMemo(() => [
    {
      title: 'Company Information',
      fields: [
        { name: 'companyName', label: 'Company Name',  type: 'text' },
        { name: 'gstin',       label: 'GSTIN',         type: 'text' },
        { name: 'address',     label: 'Address',       type: 'textarea' },
        { name: 'phone',       label: 'Phone',         type: 'text' },
        { name: 'email',       label: 'Email',         type: 'text' },
        { name: 'website',     label: 'Website',       type: 'text' },
      ],
    },
    {
      title: 'Document Numbering',
      fields: [
        { name: 'jobWorkPrefix',  label: 'Job Work Prefix',  type: 'text' },
        { name: 'challanPrefix',  label: 'Challan Prefix',   type: 'text' },
        { name: 'receiptPrefix',  label: 'Receipt Prefix',   type: 'text' },
        { name: 'invoicePrefix',  label: 'Invoice Prefix',   type: 'text' },
      ],
    },
  ], []);

  const handleChange = (key: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => { updateSettings(formState); setIsDirty(false); };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExportStatus('working');
    try {
      await exportToExcel();
      setExportStatus('done');
      setTimeout(() => setExportStatus('idle'), 4000);
    } catch (err) {
      console.error(err);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 5000);
    }
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportStatus('working');
    setImportMessage('');
    setImportCounts(null);

    const result = await importFromExcel(file);
    setImportMessage(result.message);
    setImportStatus(result.ok ? 'done' : 'error');

    if (result.ok) {
      setImportCounts(result.counts ?? null);
      await loadLocalData();
      // Short delay then reload so the Zustand store and all pages re-initialise cleanly
      setTimeout(() => window.location.reload(), 1800);
    } else {
      setTimeout(() => { setImportStatus('idle'); setImportMessage(''); }, 6000);
    }
  };

  const isOffline = connectionStatus === 'Offline';

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company details, document prefixes, and data management." />

      <div className="grid gap-6">

        {/* ── Connection status ─────────────────────────────────────────────── */}
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
          isOffline
            ? 'bg-orange-50 border-orange-200 text-orange-700'
            : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          {isOffline ? <WifiOff size={16} className="shrink-0" /> : <Wifi size={16} className="shrink-0" />}
          <span>
            <span className="font-semibold">{connectionStatus}</span>
            {isOffline
              ? ' — App works fully offline. Export a backup regularly to keep a safe copy.'
              : ' — Data is stored locally in IndexedDB. Use Auto Backup to keep dated copies automatically.'
            }
          </span>
        </div>

        {/* ── Auto Backup ──────────────────────────────────────────────────── */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-brand" />
            <h3 className="text-base font-semibold">Auto Backup</h3>
          </div>
          <p className="text-xs text-muted mb-5">
            Point the app to a folder on your computer. Every backup is saved as a new dated file —
            older ones are never overwritten, giving you a full history (up to 30 files).
            Backups run automatically when you close the tab and once per day on load.
            {!supportsFileSystemAccess && (
              <span className="block mt-1 text-orange-600 font-medium">
                ⚠ Folder access requires Chrome or Edge 86+. Use "Download Backup" to save manually.
              </span>
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

            {/* Folder picker */}
            <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-brand/10 p-2 shrink-0">
                  <FolderOpen size={16} className="text-brand" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Backup Folder</p>
                  {folderName ? (
                    <p className="text-xs text-green-700 mt-0.5 font-medium flex items-center gap-1">
                      <CheckCircle2 size={11} /> {folderName}
                    </p>
                  ) : (
                    <p className="text-xs text-muted mt-0.5">No folder selected</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-auto flex-wrap">
                {supportsFileSystemAccess && (
                  <button
                    type="button"
                    onClick={handleChooseFolder}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-brand/40 bg-brand/5 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/10 transition-colors"
                  >
                    <FolderOpen size={14} />
                    {folderName ? 'Change' : 'Choose Folder'}
                  </button>
                )}
                {folderName && (
                  <button
                    type="button"
                    onClick={handleRemoveFolder}
                    className="px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-red-600 hover:border-red-200 transition-colors"
                    title="Remove folder"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Last backup + manual trigger */}
            <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-surface p-2 shrink-0 border border-border">
                  <Clock size={16} className="text-muted" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Last Backup</p>
                  <p className="text-xs text-muted mt-0.5">
                    {lastBackupTime ? fmtTime(lastBackupTime) : 'No backup yet'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBackupNow}
                disabled={backupStatus === 'working'}
                className={`mt-auto flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors
                  ${backupStatus === 'working'
                    ? 'border-border text-muted cursor-not-allowed'
                    : backupStatus === 'done'
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : backupStatus === 'error' || backupStatus === 'no-permission'
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-brand/40 text-brand hover:bg-brand/5'
                  }`}
              >
                {backupStatus === 'working' ? (
                  <><RefreshCw size={15} className="animate-spin" /> Backing up…</>
                ) : backupStatus === 'done' ? (
                  <><CheckCircle2 size={15} /> Backup saved!</>
                ) : backupStatus === 'no-permission' ? (
                  <><AlertTriangle size={15} /> Permission denied — re-choose folder</>
                ) : backupStatus === 'error' ? (
                  <><AlertTriangle size={15} /> Backup failed — try again</>
                ) : (
                  <><HardDrive size={15} /> {folderName ? 'Backup Now' : 'Download Backup'}</>
                )}
              </button>
            </div>

            {/* How it works */}
            <div className="rounded-lg bg-surface border border-border px-4 py-3 text-xs text-muted space-y-1.5">
              <p className="font-semibold text-charcoal text-xs">How it works</p>
              <p>📁 Each backup = a new dated file — old ones are never overwritten.</p>
              <p>🔄 Auto-runs when you <strong>close the tab</strong> and once <strong>daily on load</strong>.</p>
              <p>⚡ Also runs <strong>10 s after any data change</strong> (if folder is set and permission is active).</p>
              <p>🗂 Up to <strong>30 files</strong> are kept; the oldest are deleted automatically.</p>
              {!supportsFileSystemAccess && (
                <p className="text-orange-600 font-medium">⚠ Folder backup needs Chrome/Edge 86+.</p>
              )}
            </div>
          </div>

          {/* ── Backup History ── */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                <History size={15} className="text-muted" />
                Backup History
                {history.length > 0 && (
                  <span className="text-xs font-normal text-muted">({history.length} file{history.length !== 1 ? 's' : ''})</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshHistory}
                  className="p-1.5 rounded text-muted hover:text-brand hover:bg-brand/5 transition-colors"
                  title="Refresh history"
                >
                  <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} />
                </button>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="p-1.5 rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Clear history log"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {history.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted">
                {historyLoading ? 'Loading…' : 'No backups recorded yet. Click "Backup Now" to create one.'}
              </div>
            ) : (
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {history.map((entry) => (
                  <div key={entry.filename} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface/60 transition-colors">
                    <FileSpreadsheet size={14} className="text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-charcoal truncate" title={entry.filename}>
                        {entry.filename}
                      </p>
                      <p className="text-xs text-muted">
                        {fmtTime(entry.timestamp)}
                        <span className="mx-1.5">·</span>
                        {entry.recordCount.toLocaleString('en-IN')} records
                        <span className="mx-1.5">·</span>
                        {fmtBytes(entry.sizeBytes)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ── Backup & Restore ─────────────────────────────────────────────── */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet size={18} className="text-green-600" />
            <h3 className="text-base font-semibold">Manual Export &amp; Restore</h3>
          </div>
          <p className="text-xs text-muted mb-5">
            Export a full backup as an Excel workbook you can open in Excel/Google Sheets.
            To restore, import any previously exported <code className="bg-surface px-1 rounded">.xlsx</code> file —
            records are upserted (matched by ID) and the page reloads automatically.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Export */}
            <div className="rounded-lg border border-border p-4 flex flex-col">
              <div className="flex items-start gap-3 mb-4 flex-1">
                <div className="rounded-full bg-green-50 p-2 shrink-0">
                  <Download size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Export to Excel</p>
                  <p className="text-xs text-muted mt-0.5">
                    Downloads a <code className="bg-surface px-1 rounded">.xlsx</code> with one sheet per data type —
                    Job Works, Items, Vendors, Categories, Products, References, Dispatches, Receipts, Payments.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exportStatus === 'working'}
                className={`w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors
                  ${exportStatus === 'working'
                    ? 'border-border text-muted cursor-not-allowed'
                    : exportStatus === 'done'
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : exportStatus === 'error'
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-green-300 text-green-700 hover:bg-green-50'
                  }`}
              >
                {exportStatus === 'working' ? (
                  <><RefreshCw size={14} className="animate-spin" /> Generating…</>
                ) : exportStatus === 'done' ? (
                  <><CheckCircle2 size={15} /> Downloaded</>
                ) : exportStatus === 'error' ? (
                  <><AlertTriangle size={15} /> Export failed — try again</>
                ) : (
                  <><FileSpreadsheet size={15} /> Export Backup (.xlsx)</>
                )}
              </button>
              {exportStatus === 'done' && (
                <p className="mt-2 text-xs text-green-600 text-center">Saved to your Downloads folder.</p>
              )}
            </div>

            {/* Import / Restore */}
            <div className="rounded-lg border border-border p-4 flex flex-col">
              <div className="flex items-start gap-3 mb-4 flex-1">
                <div className="rounded-full bg-amber-50 p-2 shrink-0">
                  <Upload size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Restore from Backup</p>
                  <p className="text-xs text-muted mt-0.5">
                    Pick any <code className="bg-surface px-1 rounded">.xlsx</code> backup file.
                    Records are matched by ID and upserted — existing data that isn't in the file is kept intact.
                    The app reloads automatically after a successful restore.
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importStatus === 'working' || importStatus === 'done'}
                className={`w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors
                  ${importStatus === 'working'
                    ? 'border-border text-muted cursor-not-allowed'
                    : importStatus === 'done'
                    ? 'border-green-300 bg-green-50 text-green-700 cursor-not-allowed'
                    : importStatus === 'error'
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  }`}
              >
                {importStatus === 'working' ? (
                  <><RefreshCw size={14} className="animate-spin" /> Importing…</>
                ) : importStatus === 'done' ? (
                  <><CheckCircle2 size={15} /> Restored — reloading…</>
                ) : importStatus === 'error' ? (
                  <><AlertTriangle size={15} /> Import failed</>
                ) : (
                  <><Upload size={15} /> Choose Backup File (.xlsx)</>
                )}
              </button>

              {importMessage && (
                <p className={`mt-2 flex items-center gap-1.5 text-xs ${
                  importStatus === 'done' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {importStatus === 'done' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  {importMessage}
                </p>
              )}

              {importCounts && (
                <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-xs font-semibold text-green-700 mb-2">Restored records:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(importCounts).map(([label, count]) => (
                      <div key={label} className="flex justify-between text-xs text-green-700">
                        <span>{label}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── Company & Numbering settings ──────────────────────────────────── */}
        {fieldGroups.map((group) => (
          <Card key={group.title} className="p-6">
            <CardHeader title={group.title} />
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              {group.fields.map((field) => {
                const value = formState[field.name as keyof typeof formState] as string;
                return field.type === 'textarea' ? (
                  <Textarea
                    key={field.name}
                    label={field.label}
                    value={value}
                    onChange={(e) => handleChange(field.name as keyof typeof formState, e.target.value)}
                  />
                ) : (
                  <Input
                    key={field.name}
                    label={field.label}
                    value={value}
                    onChange={(e) => handleChange(field.name as keyof typeof formState, e.target.value)}
                  />
                );
              })}
            </div>
          </Card>
        ))}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { setFormState(settings); setIsDirty(false); }} disabled={!isDirty}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!isDirty}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
