/**
 * Télécharge minio.exe (Windows amd64) dans le dossier projet minio/
 * Usage: node scripts/download-minio.mjs
 */
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'minio')
const outPath = path.join(outDir, 'minio.exe')
const url = 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe'

function fetchToFile(u, file, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'))
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'pca-cv-dashboard/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          const next = new URL(res.headers.location, u).href
          return resolve(fetchToFile(next, file, redirects + 1))
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`))
        }
        fs.mkdirSync(path.dirname(file), { recursive: true })
        const w = fs.createWriteStream(file)
        res.pipe(w)
        w.on('finish', () => w.close(resolve))
        w.on('error', reject)
      })
      .on('error', reject)
  })
}

console.log('Downloading MinIO →', outPath)
await fetchToFile(url, outPath)
const st = fs.statSync(outPath)
console.log('OK', outPath, `(${(st.size / 1024 / 1024).toFixed(1)} MB)`)
console.log('Run: .\\start-minio.bat  (data: C:\\minio-data, console :9001)')
