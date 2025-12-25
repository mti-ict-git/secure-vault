import { cn } from '@/lib/utils';
import { PasswordStrength } from '@/types/vault';

interface PasswordStrengthIndicatorProps {
  strength: PasswordStrength;
  className?: string;
}

export function PasswordStrengthIndicator({ strength, className }: PasswordStrengthIndicatorProps) {
  const config = {
    weak: { bars: 1, color: 'bg-strength-weak', label: 'Weak' },
    medium: { bars: 2, color: 'bg-strength-medium', label: 'Medium' },
    strong: { bars: 3, color: 'bg-strength-strong', label: 'Strong' },
  };

  const { bars, color, label } = config[strength];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 w-6 rounded-full transition-all duration-300',
              i <= bars ? color : 'bg-muted'
            )}
          />
        ))}
      </div>
      <span className={cn(
        'text-xs font-medium',
        strength === 'weak' && 'text-strength-weak',
        strength === 'medium' && 'text-strength-medium',
        strength === 'strong' && 'text-strength-strong'
      )}>
        {label}
      </span>
    </div>
  );
}
