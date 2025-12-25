import { PasswordStrength } from '@/types/vault';

export function generatePassword(length: number = 16, options: {
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
} = {}): string {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  let charset = '';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array, (num) => charset[num % charset.length]).join('');
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';
  
  let score = 0;
  
  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  
  // Character variety
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  // Patterns to avoid
  if (/(.)\1{2,}/.test(password)) score--; // Repeated characters
  if (/^[a-zA-Z]+$/.test(password)) score--; // Only letters
  if (/^[0-9]+$/.test(password)) score--; // Only numbers
  
  if (score <= 3) return 'weak';
  if (score <= 5) return 'medium';
  return 'strong';
}

export function maskPassword(password: string): string {
  return '•'.repeat(Math.min(password.length, 16));
}

export async function copyToClipboard(text: string, autoClearMs: number = 30000): Promise<void> {
  await navigator.clipboard.writeText(text);
  
  if (autoClearMs > 0) {
    setTimeout(async () => {
      try {
        const currentText = await navigator.clipboard.readText();
        if (currentText === text) {
          await navigator.clipboard.writeText('');
        }
      } catch {
        // Clipboard access denied, ignore
      }
    }, autoClearMs);
  }
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
