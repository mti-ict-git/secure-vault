import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings as SettingsIcon, RefreshCw } from "lucide-react";
import { request } from "@/lib/api";
import { updateThemePreference, type ThemePreference } from "@/lib/auth";

type MeResponse = { id?: string; display_name?: string; email?: string; theme_preference?: ThemePreference };

const Settings = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference>("system");

  const load = async () => {
    setIsLoading(true);
    const res = await request<MeResponse>("/me");
    if (res.ok) {
      setProfile(res.body || null);
      const t = (res.body?.theme_preference || theme) as ThemePreference;
      setThemePref(t);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const applyTheme = async (value: ThemePreference) => {
    setTheme(value);
    await updateThemePreference(value);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="text-sm text-muted-foreground">Preferences and account</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-5">
            <div className="space-y-4 p-4 border rounded-xl bg-card/40">
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme Preference</label>
                <Select value={themePref} onValueChange={(v) => setThemePref(v as ThemePreference)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="mt-2" onClick={() => void applyTheme(themePref)} disabled={isLoading}>Apply</Button>
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-7">
            <ScrollArea className="h-[50vh]">
              <div className="space-y-4">
                <div className="p-4 border rounded-xl bg-card/40">
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-6">
                      <label className="text-sm font-medium">Display Name</label>
                      <Input value={(profile?.display_name || user?.display_name || "") as string} readOnly />
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <label className="text-sm font-medium">Email</label>
                      <Input value={(profile?.email || "") as string} readOnly />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
