// Windows-focused Media Downloader (Linux instructions omitted/commented as per system configuration)
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Search, Download, Link as LinkIcon, FileDown, Globe, Play, List, AlertCircle, Terminal, Layers } from 'lucide-react';
import { Command } from '@tauri-apps/plugin-shell';
import { path } from '@tauri-apps/api';
import { toast } from "sonner";

interface SearchResult {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  webpage_url: string;
}

export function Downloader() {
  const [url, setUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('search');
  
  // Advanced options
  const [playlistItems, setPlaylistItems] = useState('');
  const [wgetFilename, setWgetFilename] = useState('');
  const [wgetReferer, setWgetReferer] = useState('');

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg].slice(-1000));
  };

  const parseProgress = (line: string) => {
    const match = line.match(/(\d+\.?\d*)%/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    setSearchResults([]);
    addLog(`🔎 Searching for: ${searchQuery}`);
    
    try {
      const cmd = Command.sidecar("ytdlp", [
        "--js-runtimes", "node",
        `ytsearch10:${searchQuery}`,
        "--dump-json",
        "--no-download"
      ]);
      
      cmd.stdout.on('data', (data: string) => {
        // Data might contain multiple JSON objects separated by newlines
        const lines = data.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const dur = json.duration;
            const formattedDur = dur ? `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}` : 'N/A';
            
            setSearchResults(prev => {
              // Avoid duplicates
              if (prev.find(item => item.id === json.id)) return prev;
              
              return [...prev, {
                id: json.id,
                title: json.title,
                thumbnail: json.thumbnail,
                duration: formattedDur,
                webpage_url: json.webpage_url
              }];
            });
          } catch (e) {
            console.error("JSON parse error for line:", line, e);
          }
        }
      });

      await cmd.spawn();
      addLog("✅ Search process started.");
    } catch (error) {
      toast.error("Search failed");
      addLog(`❌ Search error: ${error}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAnalyzeLink = async () => {
    if (!url) return;
    setIsLoading(true);
    addLog(`🔍 Analyzing link: ${url}`);
    
    try {
      if (url.includes('bigtitbitches.com')) {
        addLog("✨ Detected bigtitbitches.com - Extracting source...");
        
        const btbCmd = Command.sidecar("wget", ["-q", "-O", "-", url]);
        let btbHtml = "";
        btbCmd.stdout.on('data', (d) => btbHtml += d);
        await btbCmd.spawn();
        
        const iframeMatch = btbHtml.match(/iframe.*?src="(https:\/\/fuqster\.com\/embed\/\d+)"/);
        if (!iframeMatch) throw new Error("Embed iframe not found");
        
        const embedUrl = iframeMatch[1];
        addLog(`🔗 Found embed: ${embedUrl}`);
        
        const embedCmd = Command.sidecar("wget", ["-q", "-O", "-", embedUrl]);
        let embedHtml = "";
        embedCmd.stdout.on('data', (d) => embedHtml += d);
        await embedCmd.spawn();
        
        const videoUrlMatch = embedHtml.match(/video_url:\s*'(https:\/\/fuqster\.com\/get_file\/.*?)'/);
        if (!videoUrlMatch) throw new Error("Direct video URL not found in embed");
        
        const directUrl = videoUrlMatch[1];
        addLog("✅ successfully extracted direct URL!");
        
        setUrl(directUrl);
        setWgetReferer(embedUrl);
        setWgetFilename("video.mp4");
        setActiveTab('wget');
        toast.success("Link analyzed! switched to Wget tab.");
      } else {
        toast.info("No special extraction needed.");
        addLog("ℹ️ No special extraction found.");
      }
    } catch (e) {
      addLog(`❌ Extraction failed: ${e}`);
      toast.error("Analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  const runSingleDownload = async (targetUrl: string, service: 'ytdlp' | 'wget', label?: string): Promise<number | null> => {
    const downloadDir = await path.downloadDir();
    const smartLabel = label || (targetUrl.includes('t.me/') ? 'Telegram Link' : 'Direct Link');
    
    // Clients to rotate if 403 occurs
    const clients = service === 'ytdlp' ? ['web_embedded,mweb', 'android,web', 'ios'] : ['default'];
    let lastCode: number | null = 1;

    for (const client of clients) {
      setProgress(0);
      addLog(`🚀 [TRYING] ${client} for ${smartLabel}`);

      let args: string[] = [];
      if (service === 'ytdlp') {
        const FFMPEG_PATH = "D:\\my-py-server\\yt-dlp-desktop\\ffmpeg.exe";
        args = [
          "--js-runtimes", "node",
          "--ffmpeg-location", FFMPEG_PATH,
          "--merge-output-format", "mp4",
          "--prefer-ffmpeg",
          "--extractor-args", `youtube:player-client=${client}`,
          "--newline",
          "--progress",
          "--no-colors",
          "-P", downloadDir,
          "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
          "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "--no-check-certificate",
          "--prefer-free-formats",
          "--continue",
          "--no-overwrites"
        ];
        if (playlistItems) args.push("--playlist-items", playlistItems);
        args.push(targetUrl);
      } else {
        args = [
          "-c",
          "--progress=dot:giga",
          "-P", downloadDir,
          "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ];
        if (wgetReferer) args.push(`--referer=${wgetReferer}`);
        if (wgetFilename) args.push("-O", wgetFilename);
        args.push(targetUrl);
      }

      const cmd = Command.sidecar(service, args);

      cmd.stdout.on('data', (line) => {
        const cleanLine = line.trim();
        if (cleanLine.includes('[download]')) {
             const p = parseProgress(cleanLine);
             if (p !== null) setProgress(p);
             setLogs(prev => {
                const last = prev[prev.length - 1];
                if (last && last.startsWith('[download]') && cleanLine.startsWith('[download]')) {
                    return [...prev.slice(0, -1), cleanLine];
                }
                return [...prev, cleanLine].slice(-1000);
             });
        } else {
             addLog(cleanLine);
        }
      });

      cmd.stderr.on('data', (line) => {
        addLog(`⚠️ ERR: ${line.trim()}`);
      });

      const completion = new Promise<{ code: number | null }>((resolve) => {
          cmd.on('close', (data) => resolve(data));
      });

      await cmd.spawn();
      const output = await completion;
      lastCode = output.code;

      if (lastCode === 0) break; // Success!
      addLog(`⚠️ Client ${client} failed. Retrying next...`);
    }

    return lastCode;
  };

  const startDownload = async (targetUrl: string, service: 'ytdlp' | 'wget') => {
    setIsLoading(true);
    setLogs([]);
    const code = await runSingleDownload(targetUrl, service);
    setIsLoading(false);

    if (code === 0) {
      setProgress(100);
      toast.success("Download Finished!");
      addLog("🎉 Process completed successfully!");
    } else {
      toast.error("Download Failed");
      addLog(`❌ Process failed with code: ${code}`);
    }
  };

  const startBatchDownload = async () => {
    const urls = batchUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) return;

    setIsLoading(true);
    setLogs([]);
    addLog(`📦 Starting Batch Download for ${urls.length} items...`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      addLog(`\n🔄 Processing (${i + 1}/${urls.length})`);
      const code = await runSingleDownload(url, 'ytdlp', `Batch Item ${i + 1}`);
      if (code !== 0) {
        addLog(`⚠️ Item ${i + 1} failed with code ${code}. Continuing...`);
      }
    }

    setIsLoading(false);
    setProgress(100);
    toast.success("Batch Download Finished!");
    addLog("🎉 All batch items processed!");
  };

  return (
    <div className="flex flex-col h-full gap-6 p-6 overflow-hidden max-w-6xl mx-auto w-full">
      <div className="shrink-0 flex items-center justify-between">
        <div>
           <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-white">
             <Download className="w-8 h-8 text-blue-500" />
             Antigravity Downloader
           </h1>
           <p className="text-muted-foreground text-sm mt-1">Universal Media & File Downloader (V13.1 Desktop)</p>
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
              <TabsContent value="search" className="flex flex-col h-full p-4 m-0 overflow-hidden">
                <div className="flex flex-col gap-4 mb-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-[2px]">Enter Search Term</label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="e.g. funny cats, programming tutorials..." 
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
                        className="bg-slate-900/50 border-white/10 h-10 text-base"
                      />
                      <Button onClick={handleSearch} disabled={isSearching} className="bg-blue-600 hover:bg-blue-500 h-10 min-w-32 font-bold shadow-lg shadow-blue-500/20">
                        {isSearching ? <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                        SEARCH
                      </Button>
                    </div>
                  </div>
                </div>
                
                <ScrollArea className="flex-1 pr-3">
                  <div className="grid gap-3">
                    {searchResults.map((res) => (
                      <Card key={res.id} className="overflow-hidden bg-slate-900/30 border-white/5 hover:border-blue-500/50 transition-all duration-300 group cursor-default">
                        <div className="flex flex-col sm:flex-row h-full">
                          <div className="relative shrink-0 w-full sm:w-44 aspect-video overflow-hidden">
                            <img src={res.thumbnail} alt={res.title} className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute px-1.5 py-0.5 text-[10px] font-black rounded bg-black/90 bottom-1.5 right-1.5 text-white border border-white/10 shadow-lg">
                              {res.duration}
                            </div>
                          </div>
                          <CardContent className="flex flex-col justify-between p-3 flex-1 overflow-hidden">
                            <h3 className="font-bold text-xs line-clamp-2 text-white/90 group-hover:text-blue-400 transition-colors tracking-tight uppercase leading-relaxed">{res.title}</h3>
                            <div className="flex items-center gap-2 mt-3">
                              <Button size="sm" onClick={() => startDownload(res.webpage_url, 'ytdlp')} className="h-7 gap-1.5 text-[10px] font-bold bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/30">
                                <Download className="w-3 h-3" /> DOWNLOAD
                              </Button>
                              <a href={res.webpage_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-[10px] font-bold text-white/50 hover:text-white hover:bg-white/10">
                                  <Globe className="w-3 h-3" /> VIEW
                                </Button>
                              </a>
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    ))}
                    {!isSearching && searchResults.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/30">
                        <Play className="w-16 h-16 mb-4 opacity-10" />
                        <p className="text-sm font-medium">Search for videos to get started</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="direct" className="flex flex-col h-full p-6 m-0 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-[2px]">Direct Media/Site URL</label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Paste link here (YouTube, Twitter, BTB, etc.)" 
                        value={url}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                        className="bg-slate-900/50 border-white/10 text-base py-6 flex-1"
                      />
                      <Button variant="secondary" onClick={handleAnalyzeLink} disabled={isLoading || !url} className="h-12 px-6 font-bold border border-white/10">
                        ANALYZE
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 italic">Supports smart detection for Telegram and special sites.</p>
                  </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Playlist Items (Optional)</label>
                  <Input 
                    placeholder="e.g. 1,2,5-10" 
                    value={playlistItems}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlaylistItems(e.target.value)}
                    className="bg-slate-900/50 border-white/10"
                  />
                </div>
                <Button onClick={() => startDownload(url, 'ytdlp')} disabled={isLoading || !url} className="h-12 w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-bold shadow-lg shadow-blue-600/20">
                  <Download className="w-5 h-5" /> START YTDLP
                </Button>
                </div>
              </TabsContent>

              <TabsContent value="batch" className="flex flex-col h-full p-6 m-0 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-[2px]">Batch URL List (One per line)</label>
                    <Textarea 
                      placeholder="https://t.me/...&#10;https://youtube.com/..." 
                      value={batchUrls}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBatchUrls(e.target.value)}
                      className="bg-slate-900/50 border-white/10 min-h-[200px] font-mono text-sm leading-relaxed"
                    />
                    <p className="text-[10px] text-muted-foreground/60 italic">Links will be downloaded sequentially. Empty and invalid lines are ignored.</p>
                 </div>
                 <Button onClick={startBatchDownload} disabled={isLoading || !batchUrls} className="h-12 w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 font-bold shadow-lg shadow-blue-600/20 uppercase tracking-widest text-xs">
                    <Layers className="w-5 h-5" /> Start Batch Processing
                 </Button>
              </TabsContent>

              <TabsContent value="wget" className="flex flex-col h-full p-6 m-0 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Direct Download Link</label>
                  <Input 
                    placeholder="https://..." 
                    value={url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                    className="bg-slate-900/50 border-white/10 text-base py-6"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Output Filename</label>
                    <Input 
                      placeholder="video.mp4" 
                      value={wgetFilename}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWgetFilename(e.target.value)}
                      className="bg-slate-900/50 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[2px]">Referer URL</label>
                    <Input 
                      placeholder="https://source-site.com/..." 
                      value={wgetReferer}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWgetReferer(e.target.value)}
                      className="bg-slate-900/50 border-white/10"
                    />
                  </div>
                </div>
                <Button onClick={() => startDownload(url, 'wget')} disabled={isLoading || !url} className="h-12 w-full gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-bold shadow-lg shadow-indigo-600/20">
                  <FileDown className="w-5 h-5" /> START WGET
                </Button>
                <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                   <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                   <p className="text-[10px] text-indigo-300/60 leading-normal">Wget is ideal for direct file links that require specific headers or referer URLs.</p>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5 overflow-hidden">
          <Card className="flex flex-col h-full bg-black/60 border-white/10 backdrop-blur-3xl shadow-2xl overflow-hidden rounded-xl">
            <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                   <Terminal className="w-4 h-4 text-blue-400" />
                   <span className="text-[10px] font-black uppercase tracking-[2px] text-white/60">Console Output</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLogs([])} className="h-6 text-[9px] font-black text-white/30 hover:text-white uppercase tracking-wider">Clear</Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <ScrollArea className="flex-1 p-4 font-mono text-[10px] leading-relaxed">
                <div className="space-y-1">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-white/10">
                      <Terminal className="w-10 h-10 mb-2 opacity-10" />
                      <p className="font-bold tracking-tighter italic">WAITING FOR COMMAND...</p>
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className={`py-0.5 border-l-2 pl-3 transition-colors ${
                        log.startsWith('⚠️') ? 'text-yellow-500/80 border-yellow-500/20' : 
                        log.startsWith('❌') ? 'text-red-500/80 border-red-500/20' : 
                        log.startsWith('✅') ? 'text-green-500/80 border-green-500/20' : 
                        log.startsWith('🚀') ? 'text-blue-400 font-bold border-blue-400/20' :
                        log.startsWith('[download]') ? 'text-blue-300/60 border-white/5' :
                        log.startsWith('📦') ? 'text-purple-400 font-black border-purple-400/20' :
                        log.startsWith('🔄') ? 'text-cyan-400 font-bold border-cyan-400/20' :
                        'text-white/40 border-transparent hover:border-white/10'
                      }`}>
                        {log}
                      </div>
                    ))
                  )}
                  <div ref={endRef} />
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t border-white/5 bg-black/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-[2px]">Download Status</span>
                  <span className={`text-xs font-black ${progress === 100 ? 'text-green-400' : 'text-blue-400'}`}>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="shrink-0 flex items-center justify-center gap-6 py-2">
         <div className="flex items-center gap-1.5 grayscale opacity-20 hover:grayscale-0 hover:opacity-50 transition-all cursor-default">
            <Globe className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Multi-Site Protocol</span>
         </div>
         <div className="flex items-center gap-1.5 grayscale opacity-20 hover:grayscale-0 hover:opacity-50 transition-all cursor-default">
            <List className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Playlist Engine</span>
         </div>
         <div className="flex items-center gap-1.5 grayscale opacity-20 hover:grayscale-0 hover:opacity-50 transition-all cursor-default">
            <Terminal className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Real-time Stream</span>
         </div>
      </div>
    </div>
  );
}
