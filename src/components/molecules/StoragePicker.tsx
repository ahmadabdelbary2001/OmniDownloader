import { Folder, FolderOpen } from 'lucide-react';
import { Button } from '../ui/button';

interface StoragePickerProps {
  path: string;
  onChangePath: () => void;
  onOpenFolder: () => void;
}

export function StoragePicker({ path, onChangePath, onOpenFolder }: StoragePickerProps) {
  const folderName = path.split(/[\\\/]/).pop() || 'Downloads';

  return (
    <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-xl transition-all group overflow-hidden">
      <div
        onClick={onChangePath}
        className="flex items-center gap-3 px-4 py-2 hover:bg-muted cursor-pointer border-r border-border/50 transition-all"
      >
        <Folder className="w-4 h-4 text-[var(--acc-300)] group-hover:scale-110 transition-transform" />
        <div className="flex flex-col">
          <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Storage</span>
          <span className="text-[10px] font-bold text-foreground/60 truncate max-w-[120px]">{folderName}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-none hover:bg-primary/10 hover:text-primary transition-all"
        onClick={onOpenFolder}
      >
        <FolderOpen className="w-4 h-4" />
      </Button>
    </div>
  );
}
