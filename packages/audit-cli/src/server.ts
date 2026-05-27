import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startStudioServer() {
  const PORT = 5050;
  
  // Keep track of active SSE clients
  const clients = new Set<http.ServerResponse>();

  const server = http.createServer((req, res) => {
    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      
      clients.add(res);

      req.on('close', () => {
        clients.delete(res);
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/ingest') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          // Validate it's JSON
          JSON.parse(body);
          
          // Broadcast to all SSE clients
          for (const client of clients) {
            client.write(`data: ${body}\n\n`);
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/ai-manifest.json') {
      const manifestPath = path.join(process.cwd(), 'ai-manifest.json');
      if (fs.existsSync(manifestPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        fs.createReadStream(manifestPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Manifest not found' }));
      }
      return;
    }

    if (req.method === 'GET' && req.url === '/scan-results') {
      // Import dynamically to avoid circular dependency issues if any
      import('./scanner.js').then(({ runScannerSilent }) => {
        runScannerSilent().then(results => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(results));
        }).catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        });
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      });
      return;
    }

    // Serve static files from Vite build (dist/public)
    if (req.method === 'GET') {
      const publicDir = path.join(__dirname, 'public');
      let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url || '');
      
      // Basic security check to prevent directory traversal
      if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(publicDir, 'index.html'); // Fallback to index.html for SPA
      }

      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        let contentType = 'text/html';
        if (ext === '.js') contentType = 'application/javascript';
        else if (ext === '.css') contentType = 'text/css';
        else if (ext === '.json') contentType = 'application/json';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.svg') contentType = 'image/svg+xml';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    // The clack prompt log will be handled in index.ts
  });
}
