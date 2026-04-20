import { createClient } from 'redis'

const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
let lastRedisErrorAt = 0

export const redisClient = createClient({ url })

redisClient.on('error', (err) => {
  // Avoid flooding terminal when Redis service is unreachable on Windows.
  const now = Date.now()
  if (now - lastRedisErrorAt > 30_000) {
    console.warn('[redis] error:', err.message)
    lastRedisErrorAt = now
  }
})

export async function initRedis() {
  if (redisClient.isOpen) return
  try {
    await redisClient.connect()
    console.log('Redis: connected at', url)
  } catch (e) {
    console.warn('Redis: connection failed:', e.message)
  }
}