import { useMemo } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Copy, 
  Key,
  RefreshCw,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { PasswordEntry, PasswordStrength } from '@/types/vault';
import { evaluatePasswordStrength } from '@/lib/password-utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface SecurityDashboardProps {
  entries: PasswordEntry[];
  onEditEntry: (entry: PasswordEntry) => void;
}

interface SecurityIssue {
  entry: PasswordEntry;
  type: 'weak' | 'reused' | 'old' | 'breach';
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

// Common leaked passwords (simplified list for demo)
const COMMON_LEAKED_PASSWORDS = new Set([
  'password', 'password123', '123456', '12345678', 'qwerty', 
  'abc123', 'monkey', 'letmein', 'dragon', 'master',
  'admin', 'login', 'welcome', 'shadow', 'sunshine',
  'princess', 'football', 'baseball', 'iloveyou', 'trustno1'
]);

export function SecurityDashboard({ entries, onEditEntry }: SecurityDashboardProps) {
  const personalEntries = useMemo(() => entries.filter(e => !e.teamId), [entries]);

  const analysis = useMemo(() => {
    const issues: SecurityIssue[] = [];
    const passwordCounts = new Map<string, PasswordEntry[]>();
    
    let weakCount = 0;
    let mediumCount = 0;
    let strongCount = 0;
    let reusedCount = 0;
    let oldCount = 0;
    let potentialBreachCount = 0;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // First pass: count password occurrences and check strength
    personalEntries.forEach(entry => {
      const strength = evaluatePasswordStrength(entry.password);
      
      if (strength === 'weak') {
        weakCount++;
        issues.push({
          entry,
          type: 'weak',
          severity: 'critical',
          message: 'Weak password - easy to crack',
        });
      } else if (strength === 'medium') {
        mediumCount++;
      } else {
        strongCount++;
      }

      // Track password reuse
      const existing = passwordCounts.get(entry.password) || [];
      existing.push(entry);
      passwordCounts.set(entry.password, existing);

      // Check for old passwords
      if (entry.updatedAt < sixMonthsAgo) {
        oldCount++;
        issues.push({
          entry,
          type: 'old',
          severity: 'info',
          message: 'Password not changed in 6+ months',
        });
      }

      // Check for potentially breached passwords (common passwords)
      if (COMMON_LEAKED_PASSWORDS.has(entry.password.toLowerCase())) {
        potentialBreachCount++;
        issues.push({
          entry,
          type: 'breach',
          severity: 'critical',
          message: 'Password found in common breach lists',
        });
      }
    });

    // Second pass: find reused passwords
    passwordCounts.forEach((entriesWithPassword) => {
      if (entriesWithPassword.length > 1) {
        reusedCount += entriesWithPassword.length;
        entriesWithPassword.forEach(entry => {
          issues.push({
            entry,
            type: 'reused',
            severity: 'warning',
            message: `Password reused in ${entriesWithPassword.length} accounts`,
          });
        });
      }
    });

    // Calculate overall score
    const totalIssues = weakCount + reusedCount + potentialBreachCount;
    const totalEntries = personalEntries.length;
    const healthScore = totalEntries > 0 
      ? Math.max(0, Math.round(100 - (totalIssues / totalEntries) * 100))
      : 100;

    return {
      total: totalEntries,
      weak: weakCount,
      medium: mediumCount,
      strong: strongCount,
      reused: reusedCount,
      old: oldCount,
      potentialBreach: potentialBreachCount,
      healthScore,
      issues: issues.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
    };
  }, [personalEntries]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
  const warningIssues = analysis.issues.filter(i => i.severity === 'warning');
  const infoIssues = analysis.issues.filter(i => i.severity === 'info');

  if (personalEntries.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No passwords to analyze</h3>
        <p className="text-muted-foreground">Add some password entries to see your security score.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Score Card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Security Score</h3>
            <p className="text-sm text-muted-foreground">
              Based on password strength, reuse, and breach detection
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(analysis.healthScore)}`}>
              {analysis.healthScore}
            </div>
            <div className={`text-sm font-medium ${getScoreColor(analysis.healthScore)}`}>
              {getScoreLabel(analysis.healthScore)}
            </div>
          </div>
        </div>

        <Progress 
          value={analysis.healthScore} 
          className="h-3 mb-6"
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<ShieldCheck className="w-5 h-5 text-green-500" />}
            label="Strong"
            value={analysis.strong}
            total={analysis.total}
            color="green"
          />
          <StatCard
            icon={<Shield className="w-5 h-5 text-yellow-500" />}
            label="Medium"
            value={analysis.medium}
            total={analysis.total}
            color="yellow"
          />
          <StatCard
            icon={<ShieldAlert className="w-5 h-5 text-red-500" />}
            label="Weak"
            value={analysis.weak}
            total={analysis.total}
            color="red"
          />
          <StatCard
            icon={<Copy className="w-5 h-5 text-orange-500" />}
            label="Reused"
            value={analysis.reused}
            total={analysis.total}
            color="orange"
          />
        </div>
      </div>

      {/* Issues Breakdown */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Security Issues</h3>
        
        {analysis.issues.length === 0 ? (
          <div className="text-center py-8">
            <ShieldCheck className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-foreground font-medium">All clear!</p>
            <p className="text-sm text-muted-foreground">No security issues detected in your vault.</p>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={['critical', 'warning']}>
            {criticalIssues.length > 0 && (
              <AccordionItem value="critical" className="border-red-500/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-foreground">Critical Issues</div>
                      <div className="text-sm text-muted-foreground">{criticalIssues.length} passwords need immediate attention</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <IssueList issues={criticalIssues} onEditEntry={onEditEntry} />
                </AccordionContent>
              </AccordionItem>
            )}

            {warningIssues.length > 0 && (
              <AccordionItem value="warning" className="border-orange-500/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <Copy className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-foreground">Warnings</div>
                      <div className="text-sm text-muted-foreground">{warningIssues.length} passwords should be changed</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <IssueList issues={warningIssues} onEditEntry={onEditEntry} />
                </AccordionContent>
              </AccordionItem>
            )}

            {infoIssues.length > 0 && (
              <AccordionItem value="info" className="border-blue-500/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-foreground">Recommendations</div>
                      <div className="text-sm text-muted-foreground">{infoIssues.length} passwords could be refreshed</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <IssueList issues={infoIssues} onEditEntry={onEditEntry} />
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </div>

      {/* Breach Check Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">About Breach Detection</h4>
            <p className="text-sm text-muted-foreground mb-3">
              We check your passwords against a list of commonly leaked passwords. For enhanced security, 
              consider integrating with the Have I Been Pwned API for real-time breach detection.
            </p>
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  total,
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  
  return (
    <div className="bg-background/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground">({percentage}%)</span>
      </div>
    </div>
  );
}

function IssueList({ 
  issues, 
  onEditEntry 
}: { 
  issues: SecurityIssue[]; 
  onEditEntry: (entry: PasswordEntry) => void;
}) {
  // Group issues by entry to avoid duplicates
  const groupedByEntry = new Map<string, SecurityIssue[]>();
  issues.forEach(issue => {
    const existing = groupedByEntry.get(issue.entry.id) || [];
    existing.push(issue);
    groupedByEntry.set(issue.entry.id, existing);
  });

  return (
    <ScrollArea className="max-h-64">
      <div className="space-y-2 pt-2">
        {Array.from(groupedByEntry.entries()).map(([entryId, entryIssues]) => {
          const entry = entryIssues[0].entry;
          return (
            <div 
              key={entryId}
              className="flex items-center justify-between p-3 bg-background/50 rounded-lg hover:bg-background/80 transition-colors cursor-pointer"
              onClick={() => onEditEntry(entry)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {entry.title.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{entry.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {entryIssues.map(i => i.message).join(' • ')}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
