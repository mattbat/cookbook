// Serves the built site (_site/) at http://localhost:8080/cookbook/, the same way GitHub Pages
// does: folders serve their index.html, and anything missing gets 404.html.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.PORT || 8080)
const PREFIX = '/cookbook/'
const site = path.resolve(import.meta.dirname, '../_site')

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
}

function resolve (urlPath) {
  if (!urlPath.startsWith(PREFIX)) return null
  const file = path.join(site, decodeURIComponent(urlPath.slice(PREFIX.length)))
  if (!file.startsWith(site)) return null
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    const index = path.join(file, 'index.html')
    return fs.existsSync(index) ? index : null
  }
  return fs.existsSync(file) ? file : null
}

http.createServer((req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname
  if (urlPath === '/cookbook') {
    res.writeHead(301, { Location: PREFIX }).end()
    return
  }
  const file = resolve(urlPath)
  const status = file ? 200 : 404
  const body = file || path.join(site, '404.html')
  res.writeHead(status, { 'Content-Type': types[path.extname(body)] || 'application/octet-stream' })
  fs.createReadStream(body).pipe(res)
}).listen(PORT, () => console.log(`Serving _site at http://localhost:${PORT}${PREFIX}`))
