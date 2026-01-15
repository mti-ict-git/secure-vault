import { useState } from 'react';
import { 
  Copy, 
  Eye, 
  EyeOff, 
  Star, 
  ExternalLink, 
  MoreVertical,
  Pencil,
  Trash2,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { PasswordEntry as PasswordEntryType } from '@/types/vault';
import { copyToClipboard, maskPassword, formatDate } from '@/lib/password-utils';
import { post } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getFaviconUrlForDomain, registerFaviconFailure } from '@/lib/favicon';
import { toast } from 'sonner';

interface PasswordEntryProps {
  entry: PasswordEntryType;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onToggleFavorite: (id: string) => void;
  onEdit: (entry: PasswordEntryType) => void;
  onDelete: (id: string) => void;
}

export function PasswordEntryCard({ entry, selected, onSelectedChange, onToggleFavorite, onEdit, onDelete }: PasswordEntryProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<'password' | 'username' | null>(null);
  const [showFavicon, setShowFavicon] = useState(true);

  const handleCopy = async (text: string, type: 'password' | 'username') => {
    const autoClearMs = type === 'password' ? 30000 : 0;
    await copyToClipboard(text, autoClearMs);
    setCopied(type);
    void post('/audit/log', { action: type === 'password' ? 'password_copy' : 'username_copy', resource_type: 'entry', resource_id: entry.id });
    
    toast.success(
      type === 'password' 
        ? 'Password copied! Auto-clears in 30s' 
        : 'Username copied!'
    );
    
    setTimeout(() => setCopied(null), 2000);
  };

  const getFaviconUrl = (url?: string) => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      return getFaviconUrlForDomain(domain);
    } catch {
      return null;
    }
  };

  const favicon = getFaviconUrl(entry.url);

  return (
    <div className="vault-card p-4 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 pt-1">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked === true)}
            aria-label={selected ? 'Deselect entry' : 'Select entry'}
          />
        </div>

        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
          {favicon && showFavicon ? (
            <img
              src={favicon}
              alt=""
              className="w-5 h-5"
              onError={() => {
                let d = '';
                try {
                  d = entry.url ? new URL(entry.url).hostname : '';
                } catch {
                  d = '';
                }
                if (d) registerFaviconFailure(d);
                setShowFavicon(false);
              }}
            />
          ) : (
            <span className="text-lg font-semibold text-muted-foreground">
              {entry.title.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{entry.title}</h3>
            {entry.favorite && (
              <Star className="w-4 h-4 text-warning fill-warning flex-shrink-0" />
            )}
          </div>
          
          <p className="text-sm text-muted-foreground truncate mb-3">{entry.username}</p>

          {/* Password field */}
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              'flex-1 bg-secondary/50 rounded-md px-3 py-2 font-mono text-sm',
              showPassword ? 'tracking-normal' : 'tracking-wider'
            )}>
              {showPassword ? entry.password : maskPassword(entry.password)}
            </div>
            
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowPassword(!showPassword)}
              className="flex-shrink-0"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleCopy(entry.password, 'password')}
              className="flex-shrink-0"
            >
              {copied === 'password' ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <button
              onClick={() => handleCopy(entry.username, 'username')}
              className="hover:text-foreground transition-colors"
            >
              {copied === 'username' ? 'Copied!' : 'Copy username'}
            </button>
            
            {entry.url && (
              <>
                <span>•</span>
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  Open site <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
            
            <span className="ml-auto">Updated {formatDate(entry.updatedAt)}</span>
          </div>
        </div>

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(entry)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleFavorite(entry.id)}>
              <Star className="w-4 h-4 mr-2" />
              {entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(entry.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
