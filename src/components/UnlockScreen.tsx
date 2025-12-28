import { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface UnlockScreenProps {
  onUnlock: (password: string) => boolean;
}

export function UnlockScreen({ onUnlock }: UnlockScreenProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUnlocking(true);

    // Simulate key derivation time
    await new Promise(resolve => setTimeout(resolve, 500));

    const success = onUnlock(password);
    
    if (!success) {
      setError('Invalid master password. Must be at least 8 characters.');
      setPassword('');
    }
    
    setIsUnlocking(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6 glow-primary">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">SecureVault</h1>
          <p className="text-muted-foreground">Zero-knowledge password manager</p>
        </div>

        {/* Unlock Form */}
        <div className="vault-card p-8">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-vault-locked" />
            <span className="text-sm font-medium text-muted-foreground">Vault Locked</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="master-password" className="text-sm font-medium text-foreground">
                Master Password
              </label>
              <div className="relative">
                <Input
                  id="master-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your master password"
                  className={cn(
                    'pr-12 font-mono',
                    error && 'border-destructive focus-visible:ring-destructive'
                  )}
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm animate-slide-up">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!password || isUnlocking}
            >
              {isUnlocking ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Deriving keys...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Unlock Vault
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Your master password never leaves this device.
              <br />
              All encryption happens locally in your browser.
            </p>
            <div className="mt-4 text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">Sign in with LDAP</Link>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span>AES-256-GCM • Argon2 Key Derivation • Zero-Knowledge</span>
        </div>
      </div>
    </div>
  );
}
