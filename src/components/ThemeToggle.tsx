import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { updateThemePreference } from "@/lib/auth";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated } = useAuth();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        if (isAuthenticated) {
          await updateThemePreference(next);
        }
      }}
      className="rounded-full"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
