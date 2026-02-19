import { Toaster } from './components/ui/sonner';
import { Downloader } from './components/Downloader';
import { ThemeProvider } from './components/ThemeProvider';

const App = () => (
  <ThemeProvider defaultTheme="dark" storageKey="omni-downloader-theme">
    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/30 transition-colors duration-500 relative">
      {/* Aurora background overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.1]" style={{ background: 'radial-gradient(circle, var(--lav-400), transparent)' }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, var(--acc-300), transparent)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]" style={{ background: 'var(--grad-aurora)' }} />
      </div>
      <div className="relative">
        <Downloader />
      </div>
      <Toaster position="bottom-right" />
    </div>
  </ThemeProvider>
);

export default App;
