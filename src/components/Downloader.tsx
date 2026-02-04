import { useState } from 'react';
import { Download, Globe, List, Terminal, Search, Link as LinkIcon, Layers, FileDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "sonner";

import { useDownloader } from '../hooks/useDownloader';
import { SearchTab } from './downloader/SearchTab';
import { DirectTab } from './downloader/DirectTab';
import { BatchTab } from './downloader/BatchTab';
import { WgetTab } from './downloader/WgetTab';
import { LogViewer } from './downloader/LogViewer';
import { VideoQuality, MediaMetadata } from '../types/downloader';

export function Downloader() {
  const {
    logs,
    setLogs,
    progress,
    isLoading,
    isSearching,
    searchResults,
    handleSearch,
    startDownload,
    startBatchDownload,
    analyzeLink,
    endRef
  } = useDownloader();

  const [url, setUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  const [playlistItems, setPlaylistItems] = useState('');
  const [quality, setQuality] = useState<VideoQuality>('best');
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [wgetFilename, setWgetFilename] = useState('');
  const [wgetReferer, setWgetReferer] = useState('');

  const onAnalyze = async (inputUrl: string) => {
    const result = await analyzeLink(inputUrl);
    if (result) {
      if (result.embedUrl) {
        setUrl(result.directUrl);
        setWgetReferer(result.embedUrl);
        setWgetFilename("video.mp4");
        setActiveTab('wget');
        toast.success("Link analyzed! switched to Wget tab.");
      } else {
        setIsPlaylist(result.isPlaylist);
        setMetadata(result.metadata || null);
        toast.info(result.isPlaylist ? "Playlist detected! Items field unlocked." : "Single video analyzed.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 p-6 overflow-hidden max-w-6xl mx-auto w-full">
      <div className="shrink-0 flex items-center justify-between">
        <div>
           <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-white">
             <Download className="w-8 h-8 text-blue-500" />
             OmniDownloader
           </h1>
           <p className="text-muted-foreground text-sm mt-1">Universal Media & File Downloader (V2.0 Refactored)</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
           <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
           <span className="text-[10px] uppercase font-bold tracking-widest text-white/70">{isLoading ? 'Processing' : 'System Ready'}</span>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col h-full overflow-hidden">
            <TabsList className="grid w-full grid-cols-4 bg-slate-900/40 border border-white/10 backdrop-blur-md">
              <TabsTrigger value="search" className="gap-2 data-[state=active]:bg-blue-600"><Search className="w-4 h-4" /> Search</TabsTrigger>
              <TabsTrigger value="direct" className="gap-2 data-[state=active]:bg-blue-600"><LinkIcon className="w-4 h-4" /> Direct</TabsTrigger>
              <TabsTrigger value="batch" className="gap-2 data-[state=active]:bg-blue-600"><Layers className="w-4 h-4" /> Batch</TabsTrigger>
              <TabsTrigger value="wget" className="gap-2 data-[state=active]:bg-blue-600"><FileDown className="w-4 h-4" /> Wget</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 mt-4 overflow-hidden border rounded-xl bg-black/40 border-white/10 backdrop-blur-xl">
              <TabsContent value="search" className="h-full m-0 overflow-hidden">
                <SearchTab 
                  onSearch={handleSearch} 
                  isSearching={isSearching} 
                  searchResults={searchResults} 
                  onDownload={(u) => startDownload(u, 'ytdlp')} 
                />
              </TabsContent>

              <TabsContent value="direct" className="h-full m-0 overflow-hidden">
                <DirectTab 
                  url={url} 
                  setUrl={setUrl} 
                  playlistItems={playlistItems} 
                  setPlaylistItems={setPlaylistItems} 
                  quality={quality}
                  setQuality={setQuality}
                  isPlaylist={isPlaylist}
                  metadata={metadata}
                  onAnalyze={onAnalyze} 
                  onDownload={(u, opts) => startDownload(u, 'ytdlp', opts)} 
                  isLoading={isLoading} 
                />
              </TabsContent>

              <TabsContent value="batch" className="h-full m-0 overflow-hidden">
                <BatchTab 
                  batchUrls={batchUrls} 
                  setBatchUrls={setBatchUrls} 
                  onDownload={startBatchDownload} 
                  isLoading={isLoading} 
                />
              </TabsContent>

              <TabsContent value="wget" className="h-full m-0 overflow-hidden">
                <WgetTab 
                  url={url} 
                  setUrl={setUrl} 
                  filename={wgetFilename} 
                  setFilename={setWgetFilename} 
                  referer={wgetReferer} 
                  setReferer={setWgetReferer} 
                  onDownload={(u, opts) => startDownload(u, 'wget', opts)} 
                  isLoading={isLoading} 
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5 overflow-hidden">
          <LogViewer 
            logs={logs} 
            progress={progress} 
            onClear={() => setLogs([])} 
            endRef={endRef as React.RefObject<HTMLDivElement>} 
          />
        </div>
      </div>
      
      <div className="shrink-0 flex items-center justify-center gap-6 py-2">
         {[
           { icon: Globe, label: "Multi-Site Protocol" },
           { icon: List, label: "Playlist Engine" },
           { icon: Terminal, label: "Real-time Stream" }
         ].map((item, i) => (
           <div key={i} className="flex items-center gap-1.5 grayscale opacity-20 hover:grayscale-0 hover:opacity-50 transition-all cursor-default">
              <item.icon className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
           </div>
         ))}
      </div>
    </div>
  );
}
