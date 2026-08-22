import { useRef, useMemo, useState } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle2, Wifi, WifiOff, FileSpreadsheet } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';
import { exportToExcel, importFromExcel } from '../api/excelBackup';

export function SettingsPage() {
  const settings          = useAppStore((s) => s.settings);
  const updateSettings    = useAppStore((s) => s.updateSettings);
  const clearAllLocalData = useAppStore((s) => s.clearAllLocalData);
  const loadLocalData     = useAppStore((s) => s.loadLocalData);
  const connectionStatus  = useAppStore((s) => s.connectionStatus);

  const [formState, setFormState] = useState(settings);
  const [isDirty,   setIsDirty]   = useState(false);

  const [exportStatus,  setExportStatus]  = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [importStatus,  setImportStatus]  = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [importCounts,  setImportCounts]  = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── Clear data ──────────────────────────────────────────────────────────────
  const handleClearLocalData = async () => {
    const confirmed = window.confirm(
      'This will PERMANENTLY delete all local data.\n\nExport a backup first.\n\nContinue?',
    );
    if (!confirmed) return;
    await clearAllLocalData();
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

              {/* Import result message */}
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

          {/* ── Danger zone ── */}
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-red-700">Clear All Local Data</p>
                <p className="text-xs text-red-500 mt-0.5">
                  Permanently removes all data from this browser. Export a backup first.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleClearLocalData}
                className="shrink-0 border-red-200 text-red-600 hover:bg-red-50">
                Clear Data
              </Button>
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
