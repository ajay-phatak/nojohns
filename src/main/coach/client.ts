// AI coach client — direct Anthropic Messages API from the main process.
// One conversation at a time: a report request seeds it (system prompt +
// session.txt + trends.txt), chat turns extend it. Text deltas stream to the
// renderer through a callback; the key never leaves this module's calls.

import Anthropic from '@anthropic-ai/sdk'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import coachSystemPrompt from '../../../prompts/coach-system.md?raw'
import { getKey } from './key'

// Opus-tier coach: the analysis is cheap, the advice is the product.
const MODEL = 'claude-opus-4-8'
const MAX_TOKENS_REPORT = 4096
const MAX_TOKENS_CHAT = 2048

// $/MTok for claude-opus-4-8; cache write 1.25x input, cache read 0.1x.
const PRICE_IN = 5
const PRICE_OUT = 25
const PRICE_CACHE_WRITE = PRICE_IN * 1.25
const PRICE_CACHE_READ = PRICE_IN * 0.1

export interface CoachUsage {
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  costUsd: number
  monthUsd: number
}

export interface CoachResult {
  ok: boolean
  reason?: string
  text?: string
  usage?: CoachUsage
}

const coachDir = (): string => join(app.getPath('userData'), 'coach')

// ---------------------------------------------------------------------------
// Monthly spend counter (soft guardrail — the UI warns, nothing blocks)
// ---------------------------------------------------------------------------

const spendPath = (): string => join(coachDir(), 'spend.json')

function addSpend(usd: number): number {
  const month = new Date().toISOString().slice(0, 7)
  let rec = { month, usd: 0 }
  try {
    const read = JSON.parse(readFileSync(spendPath(), 'utf-8'))
    if (read.month === month) rec = read
  } catch {
    // first spend this month
  }
  rec.usd += usd
  mkdirSync(coachDir(), { recursive: true })
  writeFileSync(spendPath(), JSON.stringify(rec))
  return rec.usd
}

// ---------------------------------------------------------------------------
// Conversation state (one at a time; report starts fresh)
// ---------------------------------------------------------------------------

let messages: Anthropic.MessageParam[] = []
let transcriptPath: string | null = null
let busy = false

export const resetConversation = (): void => {
  messages = []
  transcriptPath = null
}

export const hasConversation = (): boolean => messages.length > 0

function costOf(usage: Anthropic.Usage): number {
  return (
    (usage.input_tokens * PRICE_IN +
      usage.output_tokens * PRICE_OUT +
      (usage.cache_creation_input_tokens ?? 0) * PRICE_CACHE_WRITE +
      (usage.cache_read_input_tokens ?? 0) * PRICE_CACHE_READ) /
    1_000_000
  )
}

function saveTranscript(): void {
  try {
    if (!transcriptPath) {
      mkdirSync(coachDir(), { recursive: true })
      transcriptPath = join(coachDir(), `coach-${Date.now()}.json`)
    }
    writeFileSync(transcriptPath, JSON.stringify({ model: MODEL, messages }, null, 2))
  } catch {
    // transcripts are best-effort
  }
}

async function runTurn(
  userContent: string,
  maxTokens: number,
  onDelta: (text: string) => void,
  fresh = false
): Promise<CoachResult> {
  // Guards come BEFORE any state change so a rejected turn never touches
  // the history of an in-flight request.
  const key = getKey()
  if (!key) return { ok: false, reason: 'no_key' }
  if (busy) return { ok: false, reason: 'busy' }
  busy = true
  if (fresh) resetConversation()
  messages.push({ role: 'user', content: userContent })
  try {
    const client = new Anthropic({ apiKey: key })
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      // Auto-cache the last cacheable block: the big report prefix caches on
      // the first call, each chat turn extends the cached prefix. Verify with
      // usage.cache_read_input_tokens > 0 on follow-up turns.
      cache_control: { type: 'ephemeral' },
      system: coachSystemPrompt,
      messages
    })
    stream.on('text', onDelta)
    const final = await stream.finalMessage()

    if (final.stop_reason === 'refusal') {
      // Don't keep a refused turn in history — let the user rephrase.
      messages.pop()
      return { ok: false, reason: 'refusal' }
    }

    messages.push({ role: 'assistant', content: final.content })
    saveTranscript()
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const costUsd = costOf(final.usage)
    return {
      ok: true,
      text,
      usage: {
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
        cacheWriteTokens: final.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
        costUsd,
        monthUsd: addSpend(costUsd)
      }
    }
  } catch (err) {
    messages.pop() // drop the user turn that failed so a retry is clean
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: 'bad_key' }
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: 'rate_limited' }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, reason: `api_error: ${err.status} ${err.message}` }
    }
    return { ok: false, reason: String(err) }
  } finally {
    busy = false
  }
}

/** Start a fresh conversation and stream the coaching report. */
export async function generateReport(
  sessionTxt: string,
  trendsTxt: string | null,
  onDelta: (text: string) => void
): Promise<CoachResult> {
  const parts = [
    'Here is my session report:\n\n```\n' + sessionTxt + '\n```',
    trendsTxt
      ? 'And my long-term trends:\n\n```\n' + trendsTxt + '\n```'
      : '(No long-term trends yet — this is an early session.)',
    'Give me the session report.'
  ]
  return runTurn(parts.join('\n\n'), MAX_TOKENS_REPORT, onDelta, true)
}

/** Ask a follow-up on the current conversation. */
export async function chat(text: string, onDelta: (t: string) => void): Promise<CoachResult> {
  if (messages.length === 0) return { ok: false, reason: 'no_conversation' }
  return runTurn(text, MAX_TOKENS_CHAT, onDelta)
}
