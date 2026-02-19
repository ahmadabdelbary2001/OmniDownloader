import { useTheme } from '../ThemeProvider';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'dark' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-[0_4px_20px_rgba(123,104,160,0.15)]',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success: 'group-[.toast]:border-[var(--acc-300)] group-[.toast]:text-[var(--acc-400)]',
          error: 'group-[.toast]:border-destructive',
          info: 'group-[.toast]:border-primary',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
