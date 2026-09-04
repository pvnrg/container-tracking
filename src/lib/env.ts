// Placeholder values shipped in .env.example -- if any of these are still
// set in a running environment, the operator forgot to generate real
// secrets. Refusing to boot beats silently running with a known/guessable
// value.
const PLACEHOLDER_VALUES = new Set([
  "changeme",
  "generate-with-openssl-rand-base64-32",
  "generate-a-random-secret",
])

type EnvCheck = { name: string; minLength?: number }

function placeholderProblem(name: string, value: string): string | null {
  if (PLACEHOLDER_VALUES.has(value)) {
    return `${name} is still set to its .env.example placeholder value -- generate a real one.`
  }
  if (value.includes("changeme")) {
    return `${name} still contains the placeholder "changeme" -- set a real value.`
  }
  return null
}

/**
 * Throws with a single, complete list of problems (not just the first) if
 * any required environment variable is missing, empty, or still set to a
 * known placeholder from .env.example. Call this as early as possible on
 * server boot (see src/instrumentation.ts) so a misconfigured deploy fails
 * immediately and loudly instead of running with weak/guessable secrets.
 */
export function assertRequiredEnv(vars: EnvCheck[]) {
  const problems: string[] = []

  for (const { name, minLength } of vars) {
    const value = process.env[name]
    if (!value || value.trim() === "") {
      problems.push(`${name} is not set.`)
      continue
    }

    const problem = placeholderProblem(name, value)
    if (problem) {
      problems.push(problem)
      continue
    }

    if (minLength && value.length < minLength) {
      problems.push(
        `${name} is only ${value.length} characters (expected at least ${minLength}) -- looks like a weak or placeholder value.`
      )
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start: ${problems.length} required environment variable(s) are missing or invalid:\n` +
        problems.map((p) => `  - ${p}`).join("\n") +
        `\n\nSee .env.example for the full list. Generate real secrets with e.g. \`openssl rand -base64 32\`.`
    )
  }
}
