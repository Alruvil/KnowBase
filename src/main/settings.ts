import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

/**
 * How the agent authenticates to Claude.
 * - `auto`: no override — the spawned Claude Code CLI uses whatever login is
 *   already on the machine (a `claude` subscription login, or ambient env vars).
 * - `subscription`: a long-lived OAuth token from `claude setup-token`
 *   (`CLAUDE_CODE_OAUTH_TOKEN`). Bills against the user's Claude subscription.
 * - `apiKey`: an Anthropic API key (`ANTHROPIC_API_KEY`). Pay-per-use fallback.
 */
export type AuthMode = 'auto' | 'subscription' | 'apiKey'

export interface AuthConfig {
  mode: AuthMode
  /** OAuth token (subscription mode) or API key (apiKey mode); empty for auto. */
  token: string
}

interface Settings {
  rootDir: string
  auth: AuthConfig
  /** Model alias/id for the agent; '' = the SDK/subscription default. */
  model: string
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

const defaults = (): Settings => ({
  rootDir: join(homedir(), 'Knowledge'),
  auth: { mode: 'auto', token: '' },
  model: ''
})

function loadSettings(): Settings {
  try {
    const raw = readFileSync(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...defaults(), ...parsed, auth: { ...defaults().auth, ...parsed.auth } }
  } catch {
    return defaults()
  }
}

function saveSettings(settings: Settings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
}

/** Returns the knowledge root directory, creating it if missing. */
export function ensureRootDir(): string {
  const { rootDir } = loadSettings()
  if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true })
  return rootDir
}

export function setRootDir(rootDir: string): void {
  saveSettings({ ...loadSettings(), rootDir })
}

function getAuth(): AuthConfig {
  return loadSettings().auth
}

export function setAuth(auth: AuthConfig): void {
  saveSettings({ ...loadSettings(), auth })
}

export function getModel(): string {
  return loadSettings().model
}

export function setModel(model: string): void {
  saveSettings({ ...loadSettings(), model })
}

/**
 * Auth details safe to send to the renderer — never the token itself, only
 * whether one is set.
 */
export function authStatus(): { mode: AuthMode; hasToken: boolean } {
  const { mode, token } = getAuth()
  return { mode, hasToken: token.trim().length > 0 }
}

/**
 * Environment overrides to apply to the spawned agent process for the current
 * auth config. `auto` returns nothing so the CLI resolves its own credentials.
 */
export function authEnv(): Record<string, string> {
  const { mode, token } = getAuth()
  const t = token.trim()
  if (mode === 'subscription' && t) return { CLAUDE_CODE_OAUTH_TOKEN: t }
  if (mode === 'apiKey' && t) return { ANTHROPIC_API_KEY: t }
  return {}
}
