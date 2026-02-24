import { Sun, Moon } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex bg-muted p-1 rounded-xl gap-1">
      <Button
        onClick={() => setTheme("light")}
        variant={theme === "light" ? "default" : "ghost"}
        className="h-8 w-8 p-0 rounded-lg transition-all"
      >
        <Sun className="w-4 h-4 text-[var(--acc-300)]" />
      </Button>
      <Button
        onClick={() => setTheme("dark")}
        variant={theme === "dark" ? "default" : "ghost"}
        className={cn(
          "h-8 w-8 p-0 rounded-lg transition-all",
          theme === "dark" && "bg-[var(--acc-300)] text-white hover:bg-[var(--acc-400)] shadow-[0_0_12px_rgba(126,202,196,0.2)]"
        )}
      >
        <Moon className="w-4 h-4" />
      </Button>
    </div>
  );
}
