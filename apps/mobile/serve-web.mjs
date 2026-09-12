import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(projectRoot, 'dist');
const indexFile = join(distDir, 'index.html');
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

if (!existsSync(indexFile)) {
  throw new Error(`Missing Expo web build output at ${indexFile}. Run "npm run build:web" first.`);
}

function resolveRequestPath(urlPath) {
  const requestedPath = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.(\/|\\|$))+/, '');
  return join(distDir, requestedPath);
}

async function sendFile(response, filePath, fallbackToIndex = true) {
  try {
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      return sendFile(response, join(filePath, 'index.html'), fallbackToIndex);
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': filePath === indexFile ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    if (fallbackToIndex && filePath !== indexFile) {
      return sendFile(response, indexFile, false);
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const requestPath = url.pathname === '/' ? indexFile : resolveRequestPath(url.pathname);
  void sendFile(response, requestPath);
}).listen(port, '0.0.0.0', () => {
  console.log(`Serving Expo web build from ${distDir} on port ${port}`);
});
