/**
 * Set MinIO bucket "cvs" to public (read+write) so n8n can upload.
 * Run from project root: node scripts/minio-set-cvs-public.mjs
 * First time: npm install minio
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
let Minio
try {
  Minio = require('minio')
} catch {
  console.error('Install minio first: npm install minio')
  process.exit(1)
}

const client = new Minio.Client({
  endPoint: '127.0.0.1',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
})

const policy = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject', 's3:PutObject'],
      Resource: ['arn:aws:s3:::cvs/*'],
    },
  ],
}

try {
  await client.setBucketPolicy('cvs', JSON.stringify(policy))
  console.log('Done. Bucket "cvs" is now public (read + write).')
} catch (e) {
  console.error('Error:', e.message)
  console.log('Make sure MinIO is running on http://127.0.0.1:9000')
  process.exit(1)
}
