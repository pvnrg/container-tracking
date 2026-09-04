import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from "./login-rate-limit"

function uniqueEmail() {
  return `test-${Math.random().toString(36).slice(2)}@example.com`
}

describe("login rate limiting", () => {
  it("allows attempts under the failure threshold", () => {
    const email = uniqueEmail()
    for (let i = 0; i < 4; i++) {
      recordFailedLogin(email)
    }
    expect(checkLoginRateLimit(email).allowed).toBe(true)
  })

  it("locks out after 5 failed attempts", () => {
    const email = uniqueEmail()
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(email)
    }
    const result = checkLoginRateLimit(email)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it("is case- and whitespace-insensitive on the email key", () => {
    const email = uniqueEmail()
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(email)
    }
    expect(
      checkLoginRateLimit(`  ${email.toUpperCase()}  `).allowed
    ).toBe(false)
  })

  it("clears the lockout once resetLoginAttempts is called", () => {
    const email = uniqueEmail()
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(email)
    }
    expect(checkLoginRateLimit(email).allowed).toBe(false)

    resetLoginAttempts(email)
    expect(checkLoginRateLimit(email).allowed).toBe(true)
  })

  it("does not lock out an email that hasn't failed at all", () => {
    expect(checkLoginRateLimit(uniqueEmail()).allowed).toBe(true)
  })
})
