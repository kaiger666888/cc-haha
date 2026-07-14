import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'
import { isEnvTruthy } from '../envUtils.js'

export type APIProvider =
  | 'firstParty'
  | 'bedrock'
  | 'vertex'
  | 'foundry'
  | 'azureOpenAI'

export function getAPIProvider(): APIProvider {
  return isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)
    ? 'bedrock'
    : isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)
      ? 'vertex'
      : isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
        ? 'foundry'
        : isEnvTruthy(process.env.CLAUDE_CODE_USE_AZURE_OPENAI)
          ? 'azureOpenAI'
        : 'firstParty'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

// Default first-party Anthropic API hosts. Localhost/loopback hosts are
// inherently trusted because they're the user's own machine (local proxies,
// gateways, dev servers) — there's no third-party risk in trusting their
// usage reports. This is what makes the GLM/Higress local gateway count
// as firstParty, fixing the "context usage shows 0%" symptom where low-trust
// usage caused `calculateContextBudget` to prefer a stale 0 estimate over
// the gateway's reported tokens.
const LOCALHOST_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
])

function getExtraTrustedHosts(): Set<string> {
  const raw = process.env.ANTHROPIC_TRUSTED_HOSTS
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(h => h.length > 0),
  )
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 *
 * Also returns true for:
 * - Any localhost/loopback host (127.0.0.1, localhost, ::1, 0.0.0.0) —
 *   the user's own machine, trusted by definition.
 * - Any host listed in the ANTHROPIC_TRUSTED_HOSTS env var (comma-separated).
 *   Lets users extend trust to self-hosted gateways without code changes.
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host.toLowerCase()
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    if (allowedHosts.includes(host)) {
      return true
    }
    // Localhost/loopback = the user's own machine → trusted.
    if (LOCALHOST_HOSTS.has(host)) {
      return true
    }
    // User-declared extra trusted hosts via env var.
    if (getExtraTrustedHosts().has(host)) {
      return true
    }
    return false
  } catch {
    return false
  }
}
