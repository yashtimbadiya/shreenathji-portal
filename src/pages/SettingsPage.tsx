import { useRef, useMemo, useState, useEffect } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle2, Wifi, WifiOff, FileSpreadsheet, FolderOpen, ShieldCheck, Clock } from 'lucide-react';
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
} from '../api/autoBackup';

export function SettingsPage() {
  const settings          = useAppStore((s) => s.settings);
  const updateSettings    = useAppStore((s) => s.updateSettings);
  const loadLocalData     = useAppStore((s) => s.loadLocalData);
  const connectionStatus  = useAppStore((s) => s.connectionStatus);

  const [formState, setFormState] = useState(settings);
  const [isDirty,   setIsDirty]   = useState(false);

  const [exportStatus,  setExportStatus]  = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [importStatus,  setImportStatus]  = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [importCounts,  setImportCounts]  = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto Backup state ───────────────────────────────────────────────────────
  const [folderName,      setFolderName]      = useState<string | null>(null);
  const [backupStatus,    setBackupStatus]    = useState<'idle' | 'working' | 'done' | 'error' | 'no-permission'>('idle');
  const [lastBackupTime,  setLastBackupTimeState] = useState<string | null>(getLastBackupTime());

  // Load saved folder name on mount
  useEffect(() => {
    loadDirectoryHandle().then(async (handle) => {
      if (!handle) return;
      const ok = await verifyPermission(handle, 'read');
      setFolderName(ok ? handle.name : null);
      if (!ok) await clearDirectoryHandle();
    });
  }, []);

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
        const ok = await writeBackupToFolder();
        if (ok) {
          setLastBackupTimeState(new Date().toISOString());
          setBackupStatus('done');
        } else {
          setBackupStatus('no-permission');
        }
      } else {
        // No folder — fall back to download
        await triggerDownloadBackup();
        setLastBackupTimeState(new Date().toISOString());
        setBackupStatus('done');
      }
    } catch {
      setBackupStatus('error');
    }
    setTimeout(() => setBackupStatus('idle'), 5000);
  };

  const formatBackupTime = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

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
      setTimeout(() => { setImportStatus('idle'); setImportMessage(''); setImportCounts(null); }, 6000);
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
              : ' — Data is stored locally in IndexedDB. Export to Excel to create a portable backup.'
            }
          </span>
        </div>

        {/* ── Backup & Restore ─────────────────────────────────────────────── */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet size={18} className="text-green-600" />
            <h3 className="text-base font-semibold">Backup &amp; Restore</h3>
          </div>
          <p className="text-xs text-muted mb-5">
            All data is stored in your browser's IndexedDB. Export to an Excel workbook to create
            a portable backup you can open in Excel/Google Sheets and restore any time.
            The workbook has one sheet per data type — Job Works, Vendors, Products, References, and more.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── Export card ── */}
            <div className="rounded-lg border border-border p-4 flex flex-col">
              <div className="flex items-start gap-3 mb-4 flex-1">
                <div className="rounded-full bg-green-50 p-2 shrink-0">
                  <Download size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Export to Excel</p>
                  <p className="text-xs text-muted mt-0.5">
                    Downloads <code className="bg-surface px-1 rounded">.xlsx</code> with separate sheets for
                    Job Works, Job Items, Vendors, Categories, Products, References, Dispatches, Receipts, and Payments.
                    Opens directly in Microsoft Excel or Google Sheets.
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
                  <>
                    <span className="animate-spin text-base">⏳</span>
                    Generating Excel…
                  </>
                ) : exportStatus === 'done' ? (
                  <><CheckCircle2 size={15} /> Downloaded</>
                ) : exportStatus === 'error' ? (
                  <><AlertTriangle size={15} /> Export failed — try again</>
                ) : (
                  <><FileSpreadsheet size={15} /> Export Backup (.xlsx)</>
                )}
              </button>
              {exportStatus === 'done' && (
                <p className="mt-2 text-xs text-green-600 text-center">
                  Excel file saved to your Downloads folder.
                </p>
              )}
            </div>

            {/* ── Import card ── */}
            <div className="rounded-lg border border-border p-4 flex flex-col">
              <div className="flex items-start gap-3 mb-4 flex-1">
                <div className="rounded-full bg-amber-50 p-2 shrink-0">
                  <Upload size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Import from Excel</p>
                  <p className="text-xs text-muted mt-0.5">
                    Pick a previously exported <code className="bg-surface px-1 rounded">.xlsx</code> backup.
                    Records with the same ID are updated; new records are added. Existing data is not deleted.
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
                disabled={importStatus === 'working'}
                className={`w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors
                  ${importStatus === 'working'
                    ? 'border-border text-muted cursor-not-allowed'
                    : importStatus === 'done'
                    ? 'border-green-300 bg-green-50 text-green-700'
                    : importStatus === 'error'
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  }`}
              >
                {importStatus === 'working' ? (
                  <><span className="animate-spin text-base">⏳</span> Importing…</>
                ) : importStatus === 'done' ? (
                  <><CheckCircle2 size={15} /> Imported successfully</>
                ) : importStatus === 'error' ? (
                  <><AlertTriangle size={15} /> Import failed</>
                ) : (
                  <><Upload size={15} /> Choose Excel File (.xlsx)</>
                )}
              </button>

              {/* ── Import result message */}
              {importMessage && (
                <p className={`mt-2 flex items-center gap-1.5 text-xs ${
                  importStatus === 'done' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {importStatus === 'done' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  {importMessage}
                </p>
              )}

              {/* Import counts breakdown */}
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

        {/* ── Auto Backup ──────────────────────────────────────────────────── */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={18} className="text-brand" />
            <h3 className="text-base font-semibold">Auto Backup</h3>
          </div>
          <p className="text-xs text-muted mb-5">
            Choose a folder on your computer. The app will automatically save an Excel backup to that folder
            when you close the tab and once per day on first load — no manual action needed.
            {!supportsFileSystemAccess && (
              <span className="block mt-1 text-orange-600 font-medium">
                ⚠ Your browser doesn't support folder access (requires Chrome or Edge 86+).
                Use "Backup Now" below to download a manual copy instead.
              </span>
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── Folder picker card ── */}
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

              <div className="flex gap-2 mt-auto">
                {supportsFileSystemAccess && (
                  <button
                    type="button"
                    onClick={handleChooseFolder}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand/5 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/10 transition-colors"
                  >
                    <FolderOpen size={14} />
                    {folderName ? 'Change Folder' : 'Choose Folder'}
                  </button>
                )}
                {folderName && (
                  <button
                    type="button"
                    onClick={handleRemoveFolder}
                    className="px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* ── Status + manual trigger ── */}
            <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-surface p-2 shrink-0 border border-border">
                  <Clock size={16} className="text-muted" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal">Last Backup</p>
                  <p className="text-xs text-muted mt-0.5">
                    {lastBackupTime
                      ? formatBackupTime(lastBackupTime)
                      : 'No backup recorded yet'}
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
                  <><span className="animate-spin text-base">⏳</span> Backing up…</>
                ) : backupStatus === 'done' ? (
                  <><CheckCircle2 size={15} /> Backup saved!</>
                ) : backupStatus === 'no-permission' ? (
                  <><AlertTriangle size={15} /> Permission denied — re-choose folder</>
                ) : backupStatus === 'error' ? (
                  <><AlertTriangle size={15} /> Backup failed — try again</>
                ) : (
                  <><Download size={15} /> {folderName ? 'Backup Now' : 'Download Backup'}</>
                )}
              </button>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-4 rounded-lg bg-surface border border-border px-4 py-3 text-xs text-muted space-y-1">
            <p className="font-semibold text-charcoal text-xs">How auto backup works:</p>
            <p>• <strong>On close</strong> — when you close the tab or browser, a backup is written automatically to your chosen folder.</p>
            <p>• <strong>Daily</strong> — the first time you open the app each day, a backup is created.</p>
            <p>• <strong>File names</strong> — each backup is saved as <code className="bg-white border border-border px-1 rounded">snj-backup-YYYY-MM-DD_HH-MM.xlsx</code> so old backups are never overwritten.</p>
            {!supportsFileSystemAccess && (
              <p className="text-orange-600 font-medium">• Folder-based backup requires Chrome or Edge. Use "Download Backup" to save manually.</p>
            )}
          </div>
        </Card>

        {/* ── Company & Numbering settings ──────────────────────────────────── */}        {fieldGroups.map((group) => (
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
