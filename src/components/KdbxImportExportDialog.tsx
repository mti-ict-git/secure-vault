import { useEffect, useState, useRef } from 'react';
import { Upload, Download, FileKey, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PasswordEntry, Folder } from '@/types/vault';
import {
  importKdbx,
  exportKdbx,
  downloadFile,
  isValidKdbxFile,
  KdbxImportedEntry,
  KdbxImportedFolder,
  KdbxImportResult,
} from '@/lib/kdbx-utils';

interface KdbxImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'import' | 'export';
  entries: PasswordEntry[];
  folders: Folder[];
  onImport: (entries: KdbxImportedEntry[], folders: KdbxImportedFolder[]) => void;
}

export function KdbxImportExportDialog({
  open,
  onOpenChange,
  initialTab,
  entries,
  folders,
  onImport,
}: KdbxImportExportDialogProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importKeyFile, setImportKeyFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<KdbxImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  
  // Export state
  const [exportPassword, setExportPassword] = useState('');
  const [exportConfirmPassword, setExportConfirmPassword] = useState('');
  const [exportName, setExportName] = useState('vault-export');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (initialTab) setActiveTab(initialTab);
  }, [open, initialTab]);

  const resetImportState = () => {
    setImportFile(null);
    setImportKeyFile(null);
    setImportPassword('');
    setImporting(false);
    setImportResult(null);
    setImportError(null);
  };

  const resetExportState = () => {
    setExportPassword('');
    setExportConfirmPassword('');
    setExportName('vault-export');
    setExporting(false);
    setExportError(null);
    setExportSuccess(false);
  };

  const close = () => {
    resetImportState();
    resetExportState();
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    close();
  };

  const handleClose = () => {
    close();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isValidKdbxFile(file)) {
        setImportError('Please select a valid .kdbx file');
        return;
      }
      setImportFile(file);
      setImportError(null);
      setImportResult(null);
    }
  };

  const handleKeyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportKeyFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    setImportError(null);

    try {
      const result = await importKdbx(importFile, importPassword, importKeyFile || undefined);
      setImportResult(result);
    } catch (error) {
      console.error('Import error:', error);
      setImportError(
        error instanceof Error 
          ? error.message.includes('Invalid credentials')
            ? 'Invalid password or key file. Please check your credentials.'
            : `Import failed: ${error.message}`
          : 'Failed to import file. Please check your password and try again.'
      );
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = () => {
    if (importResult) {
      onImport(importResult.entries, importResult.folders);
      close();
    }
  };

  const handleExport = async () => {
    if (!exportPassword) {
      setExportError('Please enter a password');
      return;
    }
    if (exportPassword !== exportConfirmPassword) {
      setExportError('Passwords do not match');
      return;
    }
    if (exportPassword.length < 8) {
      setExportError('Password must be at least 8 characters');
      return;
    }

    setExporting(true);
    setExportError(null);

    try {
      const personalEntries = entries.filter(e => !e.teamId);
      const personalFolders = folders.filter(f => !f.teamId);
      
      const data = await exportKdbx(personalEntries, personalFolders, exportPassword, {
        databaseName: exportName,
      });
      
      downloadFile(data, `${exportName}.kdbx`);
      setExportSuccess(true);
      
      // Auto-close after success
      setTimeout(() => {
        close();
      }, 2000);
    } catch (error) {
      console.error('Export error:', error);
      setExportError(
        error instanceof Error 
          ? `Export failed: ${error.message}`
          : 'Failed to export vault'
      );
    } finally {
      setExporting(false);
    }
  };

  const personalEntryCount = entries.filter(e => !e.teamId).length;
  const personalFolderCount = folders.filter(f => !f.teamId).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileKey className="w-5 h-5 text-primary" />
            KeePass Import / Export
          </DialogTitle>
          <DialogDescription>
            Import from or export to KeePass .kdbx format. All processing happens locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'export')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="gap-2">
              <Upload className="w-4 h-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4 mt-4">
            {!importResult ? (
              <>
                {/* File Selection */}
                <div className="space-y-2">
                  <Label>KeePass Database File (.kdbx)</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={importFile?.name || ''}
                      placeholder="Select a .kdbx file..."
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".kdbx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Key File (Optional) */}
                <div className="space-y-2">
                  <Label>Key File (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={importKeyFile?.name || ''}
                      placeholder="No key file selected"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => keyFileInputRef.current?.click()}
                    >
                      Browse
                    </Button>
                    <input
                      ref={keyFileInputRef}
                      type="file"
                      onChange={handleKeyFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label>Master Password</Label>
                  <Input
                    type="password"
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    placeholder="Enter the database password"
                  />
                </div>

                {importError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{importError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!importFile || !importPassword || importing}
                  >
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    {importing ? 'Importing...' : 'Import'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Import Preview */}
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Successfully parsed {importResult.stats.totalEntries} entries and {importResult.stats.totalGroups} folders.
                  </AlertDescription>
                </Alert>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">Preview</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>📁 {importResult.stats.totalGroups} folders will be created</p>
                    <p>🔐 {importResult.stats.totalEntries} password entries will be imported</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Click "Confirm Import" to add these entries to your vault.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={resetImportState}>
                    Back
                  </Button>
                  <Button onClick={confirmImport}>
                    Confirm Import
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4 mt-4">
            {exportSuccess ? (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Export successful! Your file is downloading.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">What will be exported</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>📁 {personalFolderCount} personal folders</p>
                    <p>🔐 {personalEntryCount} personal password entries</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Team/shared entries are not exported for security reasons.
                  </p>
                </div>

                {/* Export Name */}
                <div className="space-y-2">
                  <Label>Database Name</Label>
                  <Input
                    value={exportName}
                    onChange={(e) => setExportName(e.target.value)}
                    placeholder="vault-export"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label>Encryption Password</Label>
                  <Input
                    type="password"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="Enter a strong password"
                  />
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={exportConfirmPassword}
                    onChange={(e) => setExportConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                  />
                </div>

                {exportError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{exportError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExport}
                    disabled={!exportPassword || !exportConfirmPassword || exporting}
                  >
                    {exporting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {exporting ? 'Exporting...' : 'Export .kdbx'}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
