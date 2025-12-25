import { useState, useEffect } from 'react';
import { 
  Plus, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  X,
  Globe,
  User,
  Key,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { PasswordEntry } from '@/types/vault';
import { generatePassword, evaluatePasswordStrength } from '@/lib/password-utils';
import { cn } from '@/lib/utils';

interface AddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entry: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editEntry?: PasswordEntry | null;
}

export function AddEntryDialog({ open, onOpenChange, onSave, editEntry }: AddEntryDialogProps) {
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = evaluatePasswordStrength(password);

  useEffect(() => {
    if (editEntry) {
      setTitle(editEntry.title);
      setUsername(editEntry.username);
      setPassword(editEntry.password);
      setUrl(editEntry.url || '');
      setNotes(editEntry.notes || '');
    } else {
      setTitle('');
      setUsername('');
      setPassword('');
      setUrl('');
      setNotes('');
    }
  }, [editEntry, open]);

  const handleGeneratePassword = () => {
    setPassword(generatePassword(20));
    setShowPassword(true);
  };

  const handleSave = () => {
    if (!title || !username || !password) return;
    
    onSave({
      title,
      username,
      password,
      url: url || undefined,
      notes: notes || undefined,
      favorite: editEntry?.favorite || false,
      folderId: editEntry?.folderId,
    });
    
    onOpenChange(false);
  };

  const isValid = title && username && password;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editEntry ? 'Edit Entry' : 'Add New Entry'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., GitHub, Netflix, Gmail"
              icon={<FileText className="w-4 h-4" />}
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Username / Email *</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your@email.com"
              icon={<User className="w-4 h-4" />}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password *</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter or generate password"
                  icon={<Key className="w-4 h-4" />}
                  className={cn('pr-10', showPassword && 'font-mono')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={handleGeneratePassword}
                title="Generate password"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            {password && <PasswordStrengthIndicator strength={passwordStrength} />}
          </div>

          {/* URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Website URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              icon={<Globe className="w-4 h-4" />}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {editEntry ? 'Save Changes' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
