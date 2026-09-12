import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(projectRoot, 'dist');
const distRoot = resolve(distDir);
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
const assetExtensions = new Set(Object.keys(contentTypes));

if (!existsSync(indexFile)) {
  throw new Error(`Missing Expo web build output at ${indexFile}. Run "npm run build:web" first.`);
}

function resolveRequestPath(urlPath) {
  try {
    const resolvedPath = resolve(distRoot, `.${decodeURIComponent(urlPath)}`);
    return resolvedPath === distRoot || resolvedPath.startsWith(`${distRoot}${sep}`) ? resolvedPath : null;
  } catch {
    return null;
  }
}

async function sendFile(response, filePath, fallbackToIndex = true, sendBody = true) {
  try {
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      return sendFile(response, join(filePath, 'index.html'), fallbackToIndex, sendBody);
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': filePath === indexFile ? 'no-cache' : 'public, max-age=31536000, immutable',
      'Content-Length': String(fileStat.size),
      'X-Content-Type-Options': 'nosniff',
    });

    if (!sendBody) {
      response.end();
      return;
    }

    const fileContents = await readFile(filePath);
    response.end(fileContents);
  } catch (error) {
    const errorCode = error && typeof error === 'object' && 'code' in error ? error.code : undefined;

    if ((errorCode === 'ENOENT' || errorCode === 'ENOTDIR') && fallbackToIndex && filePath !== indexFile) {
      return sendFile(response, indexFile, false, sendBody);
    }

    response.writeHead(errorCode === 'ENOENT' || errorCode === 'ENOTDIR' ? 404 : 500, {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(errorCode === 'ENOENT' || errorCode === 'ENOTDIR' ? 'Not found' : 'Internal server error');
  }
}

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, {
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end('Method not allowed');
    return;
  }

  const url = new URL(request.url ?? '/', 'http://localhost');
  const requestPath = url.pathname === '/' ? indexFile : resolveRequestPath(url.pathname);
  const allowSpaFallback = !url.pathname.startsWith('/_expo/') && !assetExtensions.has(extname(url.pathname));
  const sendBody = request.method !== 'HEAD';

  if (!requestPath) {
    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end('Not found');
    return;
  }

  void sendFile(response, requestPath, allowSpaFallback, sendBody);
}).listen(port, '0.0.0.0', () => {
  console.log(`Serving Expo web build from ${distDir} on port ${port}`);
});
