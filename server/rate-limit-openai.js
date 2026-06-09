import { redisClient } from './redis-client.js'

const MAX_OPENAI_PER_DAY = Number(process.env.OPENAI_DAILY_LIMIT || 100)

export async function rateLimitOpenAI(req, res, next) {
  try {
    // Utilise l'id utilisateur si dispo, sinon l'IP comme fallback
    const userId = req.user?.id || req.ip || 'anonymous'
    const key = `openai:day:${userId}`

    if (!redisClient.isOpen) {
      // Pas de Redis → on laisse passer sans rate limit (ne pas casser la prod)
      return next()
    }

    const count = await redisClient.incr(key)
    if (count === 1) {
      // Expire après 24h
      await redisClient.expire(key, 24 * 60 * 60)
    }

    if (count > MAX_OPENAI_PER_DAY) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Quota OpenAI journalier dépassé pour cet utilisateur.',
      })
    }

    return next()
  } catch (e) {
    console.warn('[rateLimitOpenAI] Redis error:', e.message)
    // En cas de problème Redis, ne pas bloquer la requête
    return next()
  }
}

