import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { safePath } from './fs-service'
import { composeSystemPrompt } from './prompt-service'
import { authEnv, authStatus, getModel } from './settings'
import { projectOf } from './history-service'
import { log } from './logger'

/** Tools the assistant may use, all auto-approved (no interactive prompts). */
const TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write']

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: string; detail: string }
  | { type: 'done'; costUsd: number; inputTokens: number; outputTokens: number; model?: string }
  | { type: 'error'; message: string }

/** Sum input/output tokens from an SDK result's usage (incl. cached input). */
function tokensOf(usage: unknown): { input: number; output: number } {
  const u = (usage ?? {}) as Record<string, unknown>
  const n = (v: unknown): number => (typeof v === 'number' ? v : 0)
  const input =
    n(u.input_tokens) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens)
  return { input, output: n(u.output_tokens) }
}

function summarizeTool(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>
  const path = (i.file_path ?? i.path) as string | undefined
  const pattern = (i.pattern ?? i.query) as string | undefined
  if (path) return `${name} ${String(path).split('/').pop()}`
  if (pattern) return `${name} "${pattern}"`
  return name
}

interface RunOptions {
  root: string
  /** Root-relative folder the console is scoped to (the AI's cwd). */
  contextFolder: string
  prompt: string
  requestId: string
  signal: AbortSignal
  emit: (event: AgentEvent) => void
}

/**
 * Run one agent turn scoped to the context folder, streaming events to `emit`.
 *
 * Calls are STATELESS: each turn is a fresh session with no memory of prior
 * turns. Its only inputs are the composed system prompt (the `_prompt.md`
 * cascade), the files the agent reads (including any referenced in the prompt),
 * and the prompt text itself.
 */
export async function runAgent({
  root,
  contextFolder,
  prompt,
  requestId,
  signal,
  emit
}: RunOptions): Promise<void> {
  const cwd = safePath(root, contextFolder)
  const project = projectOf(contextFolder)
  const systemPrompt = await composeSystemPrompt(root, contextFolder)
  const controller = new AbortController()
  signal.addEventListener('abort', () => controller.abort())
  const auth = authStatus()
  const model = getModel()

  let emittedText = false

  log('agent', 'turn start', {
    requestId,
    project,
    cwd,
    contextFolder,
    promptChars: prompt.length,
    systemPromptChars: systemPrompt.length,
    model: model || '(default)',
    authMode: auth.mode,
    authHasToken: auth.hasToken,
    // Which env var(s) we're overriding on the spawned process — not the values.
    authEnvKeys: Object.keys(authEnv())
  })

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd,
        systemPrompt,
        tools: TOOLS,
        allowedTools: TOOLS,
        permissionMode: 'dontAsk',
        abortController: controller,
        ...(model ? { model } : {}),
        env: { ...process.env, ...authEnv() }
      }
    }) as AsyncIterable<SDKMessage>) {
      if (message.type === 'assistant') {
        if (message.error) log('agent', 'assistant error', { requestId, err: message.error })
        for (const block of message.message.content) {
          if (block.type === 'text' && block.text) {
            emittedText = true
            emit({ type: 'text', text: block.text })
          } else if (block.type === 'tool_use') {
            log('agent', 'tool_use', { requestId, tool: block.name })
            emit({ type: 'tool', tool: block.name, detail: summarizeTool(block.name, block.input) })
          }
        }
      } else if (message.type === 'result') {
        const usedModel = Object.keys(
          (message as { modelUsage?: Record<string, unknown> }).modelUsage ?? {}
        )[0]
        log('agent', 'result', {
          requestId,
          subtype: message.subtype,
          is_error: message.is_error,
          num_turns: message.num_turns,
          cost_usd: message.total_cost_usd,
          stop_reason: message.stop_reason,
          model: usedModel,
          api_error_status: 'api_error_status' in message ? message.api_error_status : undefined,
          resultPreview:
            message.subtype === 'success' ? message.result?.slice(0, 300) : message.errors
        })
        if (message.subtype === 'success' && !message.is_error && message.num_turns === 0) {
          // The model never ran a turn — almost always an auth/login gate.
          const raw = message.result?.trim()
          emit({
            type: 'error',
            message: `${raw ? raw + ' — ' : ''}The AI could not run. Set your Claude auth in the console ⚙ settings (subscription token or API key).`
          })
        } else if (message.subtype === 'success' && !message.is_error) {
          // Some short answers come only via `result`, not as a streamed text block.
          if (!emittedText && message.result?.trim()) emit({ type: 'text', text: message.result })
          const t = tokensOf(message.usage)
          emit({
            type: 'done',
            costUsd: message.total_cost_usd,
            inputTokens: t.input,
            outputTokens: t.output,
            model: usedModel
          })
        } else {
          const detail =
            message.subtype === 'success'
              ? message.result?.trim() ||
                `Request failed${
                  message.api_error_status ? ` (HTTP ${message.api_error_status})` : ''
                }`
              : message.errors?.join('; ') || `Agent stopped: ${message.subtype}`
          emit({ type: 'error', message: detail })
        }
      } else if (message.type === 'system' && message.subtype === 'init') {
        log('agent', 'init', {
          requestId,
          apiKeySource: message.apiKeySource,
          model: message.model,
          cwd: message.cwd,
          permissionMode: message.permissionMode
        })
      } else {
        log('agent', 'sdk message', { requestId, type: message.type })
      }
    }
    log('agent', 'turn end', { requestId })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('agent', 'turn threw', {
      requestId,
      error: message,
      stack: err instanceof Error ? err.stack : undefined
    })
    emit({ type: 'error', message })
  }
}
