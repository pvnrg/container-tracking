// In-memory login throttle, keyed by the attempted email. This is
// per-process state -- fine for this app's single pm2 instance, but would
// need a shared store (e.g. Redis) if this ever runs as multiple
// instances, since each instance would otherwise track attempts
// independently and the real limit would be N times higher than intended.

const MAX_ATTEMPTS = 5
const WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

type AttemptRecord = {
  count: number
  windowStartedAt: number
  lockedUntil?: number
}

const attempts = new Map<string, AttemptRecord>()

function normalize(email: string) {
  return email.trim().toLowerCase()
}

// Opportunistic cleanup on every call keeps the map from growing
// unboundedly over long uptime, without needing a background timer.
function pruneStale(now: number) {
  for (const [key, record] of attempts) {
    const expired = record.lockedUntil
      ? now > record.lockedUntil
      : now - record.windowStartedAt > WINDOW_MS
    if (expired) attempts.delete(key)
  }
}

export function checkLoginRateLimit(email: string): {
  allowed: boolean
  retryAfterMs?: number
} {
  const now = Date.now()
  pruneStale(now)

  const record = attempts.get(normalize(email))
  if (record?.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, retryAfterMs: record.lockedUntil - now }
  }

  return { allowed: true }
}

export function recordFailedLogin(email: string) {
  const now = Date.now()
  const key = normalize(email)
  const record = attempts.get(key)

  if (!record || now - record.windowStartedAt > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStartedAt: now })
    return
  }

  record.count += 1
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS
  }
}

export function resetLoginAttempts(email: string) {
  attempts.delete(normalize(email))
}
