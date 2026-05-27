import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, FileCode, LayoutDashboard, Terminal, ExternalLink } from 'lucide-react';

interface TelemetryEvent {
  id: string;
  timestamp: string;
  model?: string;
  status: 'passed' | 'blocked';
  prompt?: string;
  scrubbedPrompt?: string;
  errors?: { code: string; message: string }[];
}

interface ScanResult {
  file: string;
  absolutePath: string;
  compliant: boolean;
  errors: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'issues'>('overview');
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [scanResults, setScanResults] = useState<ScanResult[] | null>(null);

  useEffect(() => {
    // Connect to the local CLI SSE stream
    const eventSource = new EventSource('http://localhost:5050/events');
    
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as TelemetryEvent;
        setEvents((prev) => [data, ...prev]);
        if (activeTab !== 'telemetry') setActiveTab('telemetry');
      } catch (err) {
        console.error('Failed to parse SSE', err);
      }
    };

    return () => eventSource.close();
  }, [activeTab]);

  useEffect(() => {
    fetch('http://localhost:5050/ai-manifest.json')
      .then(res => res.json())
      .then(data => setManifest(data))
      .catch(console.error);

    fetch('http://localhost:5050/scan-results')
      .then(res => res.json())
      .then(data => setScanResults(data.results))
      .catch(console.error);
  }, []);

  const handleGenerateTrustCenter = async () => {
    try {
      if (!manifest) return alert('Manifest not loaded yet.');
      const ingestUrl = process.env.NODE_ENV === 'production' 
        ? 'https://attestly.dev/api/ingest/manifest' 
        : 'http://localhost:3000/api/ingest/manifest';
        
      const res = await fetch(ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
      });

      if (!res.ok) throw new Error('Failed to handoff manifest');

      const data = await res.json();
      
      if (data.sessionId) {
        const baseUrl = process.env.NODE_ENV === 'production' ? 'https://attestly.dev' : 'http://localhost:3000';
        window.location.href = `${baseUrl}/dashboard/onboarding?session=${data.sessionId}&repo=${encodeURIComponent('local')}`;
      }
    } catch (e) {
      console.error(e);
      // Fallback: direct deep link
      const baseUrl = process.env.NODE_ENV === 'production' ? 'https://attestly.dev' : 'http://localhost:3000';
      window.location.href = `${baseUrl}/dashboard/onboarding?manifest=${encodeURIComponent(JSON.stringify(manifest))}`;
    }
  };

  const getVSCodeLink = (absolutePath: string) => {
    return `vscode://file/${encodeURIComponent(absolutePath)}`;
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-300 font-sans selection:bg-emerald-500/30">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
          <Shield className="h-6 w-6 text-emerald-500" />
          <h1 className="text-lg font-bold tracking-tight text-white">Attestly Studio</h1>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
          >
            <LayoutDashboard className="h-4 w-4" /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('telemetry')}
            className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'telemetry' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
          >
            <div className="flex items-center gap-3">
              <Terminal className="h-4 w-4" /> Live Telemetry
            </div>
            {events.length > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400 border border-emerald-500/20">{events.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('issues')}
            className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'issues' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
          >
            <div className="flex items-center gap-3">
              <FileCode className="h-4 w-4" /> Static Issues
            </div>
            {scanResults?.some(r => !r.compliant) && (
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-400 border border-rose-500/20">
                {scanResults.filter(r => !r.compliant).length}
              </span>
            )}
          </button>
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <button 
            onClick={handleGenerateTrustCenter}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 transition-colors flex justify-center items-center gap-2"
          >
            Generate Trust Center <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Active Configuration</h2>
                <p className="mt-1 text-sm text-zinc-400">Current running rules from ai-manifest.json</p>
              </div>
              
              {manifest ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Approved Models</h3>
                    <div className="flex flex-wrap gap-2">
                      {manifest.allowedModels?.map((m: string) => (
                        <span key={m} className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-300 border border-zinc-700">{m}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">EU AI Act Profile</h3>
                    <dl className="space-y-4 text-sm">
                      <div>
                        <dt className="text-zinc-500">System Domain</dt>
                        <dd className="mt-1 font-medium text-emerald-400 capitalize">{manifest.systemDomain}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Risk Category</dt>
                        <dd className="mt-1 font-medium text-amber-400 capitalize">{manifest.euRiskCategory} Risk</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">PII Scrubbing</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${manifest.piiScrubbing?.level !== 'off' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                        {manifest.piiScrubbing?.level.toUpperCase()}
                      </span>
                    </div>
                    {manifest.piiScrubbing?.level !== 'off' && (
                      <p className="text-sm text-zinc-400">All outbound payloads are automatically scanned and redacted for Emails, SSNs, Credit Cards, and API Keys.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="animate-pulse flex space-x-4 p-6 border border-zinc-800 rounded-xl bg-zinc-900/50">
                  <div className="flex-1 space-y-6 py-1">
                    <div className="h-2 bg-zinc-700 rounded w-1/4"></div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-2 bg-zinc-700 rounded col-span-2"></div>
                        <div className="h-2 bg-zinc-700 rounded col-span-1"></div>
                      </div>
                      <div className="h-2 bg-zinc-700 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'telemetry' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left Column: Feed */}
            <div className="w-1/3 flex-col border-r border-zinc-800 bg-zinc-950 flex overflow-y-auto">
              <div className="sticky top-0 bg-zinc-950/95 backdrop-blur z-10 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Live Traffic</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              {events.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-zinc-500">
                  <Clock className="mb-4 h-8 w-8 text-zinc-700" />
                  <p>Listening for AI requests on port 5050...</p>
                  <p className="text-xs text-zinc-600 mt-2">Trigger a wrapped API route in your app to see it here.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={`w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-zinc-900 ${selectedEvent?.id === ev.id ? 'bg-zinc-900 ring-1 ring-inset ring-zinc-800' : ''}`}
                    >
                      {ev.status === 'blocked' ? (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                      ) : (
                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                      )}
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <p className="truncate font-medium text-zinc-200">{ev.model || 'Unknown Model'}</p>
                          <span className="text-xs font-mono text-zinc-600">
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {ev.status === 'blocked' ? ev.errors?.[0]?.code : 'Passed Compliance Check'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Inspector */}
            <div className="flex-1 flex-col bg-[#09090b] p-8 overflow-y-auto">
              {selectedEvent ? (
                <div className="mx-auto max-w-4xl space-y-6">
                  <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                    {selectedEvent.status === 'blocked' ? (
                      <div className="flex items-center gap-2 rounded bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="h-3 w-3" /> BLOCKED
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="h-3 w-3" /> PASSED
                      </div>
                    )}
                    <span className="text-sm font-mono text-zinc-500">
                      {new Date(selectedEvent.timestamp).toLocaleString()}
                    </span>
                    <span className="text-sm font-mono text-zinc-400 ml-auto bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                      {selectedEvent.model}
                    </span>
                  </div>

                  {selectedEvent.status === 'blocked' && selectedEvent.errors && (
                    <div className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-5">
                      <h3 className="font-semibold text-rose-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> EU AI Act / Compliance Violations
                      </h3>
                      <ul className="mt-3 space-y-3">
                        {selectedEvent.errors.map((err, i) => (
                          <li key={i} className="text-sm text-rose-300/80 bg-rose-950/50 p-3 rounded border border-rose-900/30">
                            <span className="font-mono font-bold text-rose-400 block mb-1">[{err.code}]</span> {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {selectedEvent.prompt && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden flex flex-col">
                        <div className="bg-zinc-800/50 px-4 py-2 border-b border-zinc-800">
                          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Raw Request Payload</h3>
                        </div>
                        <pre className="flex-1 whitespace-pre-wrap p-4 text-xs text-zinc-300 font-mono overflow-x-auto">
                          {selectedEvent.prompt}
                        </pre>
                      </div>
                    )}

                    {selectedEvent.scrubbedPrompt && selectedEvent.status === 'passed' && (
                      <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 overflow-hidden flex flex-col">
                        <div className="bg-emerald-900/20 px-4 py-2 border-b border-emerald-900/30">
                          <h3 className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">PII Scrubbed Forwarded Payload</h3>
                        </div>
                        <pre className="flex-1 whitespace-pre-wrap p-4 text-xs text-emerald-400/90 font-mono overflow-x-auto">
                          {selectedEvent.scrubbedPrompt}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600">
                  Select an event from the feed to inspect it.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Static Compliance Issues</h2>
                <p className="mt-1 text-sm text-zinc-400">Issues detected in your codebase by the Attestly Scanner.</p>
              </div>

              {!scanResults ? (
                 <div className="animate-pulse flex space-x-4 p-6 border border-zinc-800 rounded-xl bg-zinc-900/50">
                   <div className="h-4 bg-zinc-700 rounded w-1/4"></div>
                 </div>
              ) : scanResults.filter(r => !r.compliant).length === 0 ? (
                <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-12 text-center flex flex-col items-center">
                  <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 ring-1 ring-emerald-500/50">
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-medium text-emerald-400">100% Compliant</h3>
                  <p className="text-sm text-emerald-500/70 mt-1">No static compliance issues found in your codebase.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scanResults.filter(r => !r.compliant).map((res, i) => (
                    <div key={i} className="rounded-xl border border-rose-900/30 bg-rose-950/10 overflow-hidden">
                      <div className="flex items-center justify-between border-b border-rose-900/30 bg-rose-900/20 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4 text-rose-400" />
                          <span className="text-sm font-mono text-rose-200">{res.file}</span>
                        </div>
                        <a 
                          href={getVSCodeLink(res.absolutePath)}
                          className="text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-3 py-1 rounded transition-colors border border-rose-500/30"
                        >
                          Fix in VS Code
                        </a>
                      </div>
                      <div className="p-4">
                        <ul className="space-y-3">
                          {res.errors.map((err, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-rose-300/80">
                              <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                              <span>{err}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
