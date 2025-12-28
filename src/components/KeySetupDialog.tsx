import { useState } from 'react';
import { Shield, KeyRound, Loader2, CheckCircle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { generateSigningKeyPair, generateEncryptionKeyPair } from '@/lib/crypto/box';
import { encryptPrivateKeys, type PrivateKeysPlain } from '@/lib/crypto/privateKeys';
import { post } from '@/lib/api';

interface KeySetupDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function KeySetupDialog({ open, onComplete }: KeySetupDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'intro' | 'password' | 'generating' | 'complete'>('intro');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleStartSetup = () => {
    setStep('password');
  };

  const handleGenerateKeys = async () => {
    if (passphrase.length < 8) {
      toast({
        title: 'Passphrase too short',
        description: 'Please use at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (passphrase !== confirmPassphrase) {
      toast({
        title: 'Passphrases do not match',
        description: 'Please ensure both passphrases match.',
        variant: 'destructive',
      });
      return;
    }

    setStep('generating');
    setIsGenerating(true);

    try {
      // Generate keypairs
      const signingKp = await generateSigningKeyPair();
      const encryptionKp = await generateEncryptionKeyPair();

      const plainKeys: PrivateKeysPlain = {
        sign_sk_b64: signingKp.secretKey_b64,
        enc_sk_b64: encryptionKp.secretKey_b64,
        sign_pk_b64: signingKp.publicKey_b64,
        enc_pk_b64: encryptionKp.publicKey_b64,
      };

      // Encrypt private keys with passphrase
      const encryptedPrivateKey = await encryptPrivateKeys(passphrase, plainKeys);
      const encryptedPrivateKeyJson = JSON.stringify(encryptedPrivateKey);

      // Register keys with backend
      const res = await post('/keys/register', {
        public_sign_key: signingKp.publicKey_b64,
        public_enc_key: encryptionKp.publicKey_b64,
        encrypted_private_key: encryptedPrivateKeyJson,
      });

      if (!res.ok) {
        throw new Error('Failed to register keys');
      }

      setStep('complete');
      toast({
        title: 'Keys registered',
        description: 'Your encryption keys have been set up securely.',
      });

      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      console.error('Key generation failed:', error);
      toast({
        title: 'Key setup failed',
        description: 'There was an error setting up your keys. Please try again.',
        variant: 'destructive',
      });
      setStep('password');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            {step === 'complete' ? (
              <CheckCircle className="w-6 h-6 text-primary" />
            ) : (
              <KeyRound className="w-6 h-6 text-primary" />
            )}
          </div>
          <DialogTitle className="text-center">
            {step === 'intro' && 'Set Up Your Encryption Keys'}
            {step === 'password' && 'Create Your Master Passphrase'}
            {step === 'generating' && 'Generating Keys...'}
            {step === 'complete' && 'Keys Ready!'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 'intro' &&
              'Before you can use the vault, we need to generate your personal encryption keys. These keys protect your data.'}
            {step === 'password' &&
              'Enter a strong passphrase to protect your private keys. You will need this passphrase to unlock your vault.'}
            {step === 'generating' &&
              'Please wait while we generate your cryptographic keys...'}
            {step === 'complete' &&
              'Your encryption keys have been set up. You can now use the vault securely.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {step === 'intro' && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">End-to-End Encryption</p>
                    <p className="text-xs text-muted-foreground">
                      Your data is encrypted before leaving your device.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <KeyRound className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Zero-Knowledge</p>
                    <p className="text-xs text-muted-foreground">
                      The server never sees your unencrypted data or keys.
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={handleStartSetup} className="w-full">
                Continue
              </Button>
            </>
          )}

          {step === 'password' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="passphrase">Master Passphrase</Label>
                <Input
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter a strong passphrase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-passphrase">Confirm Passphrase</Label>
                <Input
                  id="confirm-passphrase"
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => setConfirmPassphrase(e.target.value)}
                  placeholder="Confirm your passphrase"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use at least 8 characters. This passphrase protects your private keys.
              </p>
              <Button
                onClick={handleGenerateKeys}
                className="w-full"
                disabled={!passphrase || !confirmPassphrase}
              >
                Generate Keys
              </Button>
            </>
          )}

          {step === 'generating' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Deriving keys with Argon2id...
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="flex flex-col items-center py-4">
              <p className="text-sm text-muted-foreground">Redirecting to vault...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
