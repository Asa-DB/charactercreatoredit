const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT) || 3000;
const host = '127.0.0.1';
const projectRoot = __dirname;
const charactersDirectory = path.join(projectRoot, 'data', 'characters');

const routes = {
  '/': 'index.html',
  '/creator': 'creator.html',
  '/characters': 'characters.html',
  '/characters.js': 'characters.js',
  '/script.js': 'script.js',
  '/styles.css': 'styles.css'
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav'
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(data));
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, fileBuffer) => {
    if (error) {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream'
    });
    response.end(fileBuffer);
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });

    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function safeFileName(fileName) {
  const baseName = path.basename(fileName, '.txt');
  const cleanedName = baseName.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').toLowerCase();
  const finalName = cleanedName || 'character';
  return `${Date.now()}-${finalName}.txt`;
}

async function listCharacters() {
  const fileNames = await fs.promises.readdir(charactersDirectory);

  const characters = await Promise.all(fileNames
    .filter((fileName) => fileName.endsWith('.txt'))
    .map(async (fileName) => {
      const filePath = path.join(charactersDirectory, fileName);
      const [content, stats] = await Promise.all([
        fs.promises.readFile(filePath, 'utf8'),
        fs.promises.stat(filePath)
      ]);

      return {
        id: fileName,
        originalName: fileName.replace(/^\d+-/, ''),
        content,
        updatedAt: stats.mtime.toISOString()
      };
    }));

  characters.sort((firstCharacter, secondCharacter) => {
    return secondCharacter.updatedAt.localeCompare(firstCharacter.updatedAt);
  });

  return characters;
}

async function saveCharacter(request, response) {
  const requestBody = await readRequestBody(request);
  const { filename, content } = JSON.parse(requestBody);

  if (typeof filename !== 'string' || !filename.endsWith('.txt')) {
    sendJson(response, 400, { error: 'Upload a .txt file.' });
    return;
  }

  if (typeof content !== 'string' || content.trim() === '') {
    sendJson(response, 400, { error: 'Character file is empty.' });
    return;
  }

  const savedFileName = safeFileName(filename);
  const savedFilePath = path.join(charactersDirectory, savedFileName);

  await fs.promises.writeFile(savedFilePath, content, 'utf8');
  sendJson(response, 201, { ok: true });
}

function isAssetRequest(requestPath) {
  return requestPath.startsWith('/assets/');
}

function createServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const requestPath = requestUrl.pathname;

    try {
      if (request.method === 'GET' && requestPath === '/api/characters') {
        const characters = await listCharacters();
        sendJson(response, 200, characters);
        return;
      }

      if (request.method === 'POST' && requestPath === '/api/characters') {
        await saveCharacter(request, response);
        return;
      }

      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
      }

      if (routes[requestPath]) {
        sendFile(response, path.join(projectRoot, routes[requestPath]));
        return;
      }

      if (isAssetRequest(requestPath)) {
        sendFile(response, path.join(projectRoot, requestPath));
        return;
      }

      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      sendJson(response, 500, { error: error.message || 'Server error.' });
    }
  });
}

fs.promises.mkdir(charactersDirectory, { recursive: true }).then(() => {
  createServer().listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
  });
});
