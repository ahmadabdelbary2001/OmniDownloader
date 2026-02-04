import { Toaster } from './components/ui/sonner';
import { Downloader } from './components/Downloader';

const App = () => (
  <div className="dark min-h-screen bg-background text-foreground font-sans antialiased selection:bg-blue-500/30">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px] pointer-events-none" />
      <div className="relative">
        <Downloader />
      </div>
      <Toaster position="bottom-right" theme="dark" />
  </div>
);

export default App;
