import { createClient } from 'redis'

const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

export const redisClient = createClient({ url })

redisClient.on('error', (err) => {
  console.warn('[redis] error:', err.message)
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