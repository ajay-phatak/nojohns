// Sentinel-comment merge for generated notes. Generated regions live between
// `<!-- nojohns:begin <id> -->` / `<!-- nojohns:end <id> -->` markers and are
// replaced wholesale on every write; everything outside the markers belongs to
// the user and is preserved byte-for-byte.

export interface BlockPart {
  kind: 'block'
  id: string
  body: string
}

export interface TextPart {
  kind: 'text'
  text: string
}

// A note template: blocks are regenerated on every write; text parts are
// user-editable seed content emitted only when the file is first created.
export type NotePart = BlockPart | TextPart

export const beginMarker = (id: string): string => `<!-- nojohns:begin ${id} -->`
export const endMarker = (id: string): string => `<!-- nojohns:end ${id} -->`

const renderBlock = (b: BlockPart): string => `${beginMarker(b.id)}\n${b.body}\n${endMarker(b.id)}`

// Regex for one block's full span (markers included). Block ids are
// [a-z0-9-] by construction, so no escaping is needed.
const blockRe = (id: string): RegExp =>
  new RegExp(`<!-- nojohns:begin ${id} -->[\\s\\S]*?<!-- nojohns:end ${id} -->`)

/** Inner content of a named block in an existing note, or null when absent
 *  (file missing, block deleted by the user, or malformed markers). */
export function extractBlock(existing: string | null, id: string): string | null {
  if (existing === null) return null
  const m = existing.match(blockRe(id))
  if (!m) return null
  return m[0]
    .slice(beginMarker(id).length, m[0].length - endMarker(id).length)
    .replace(/^\n/, '')
    .replace(/\n$/, '')
}

/**
 * Merge a template into an existing note. New file: emit the full template.
 * Existing file: regenerate each named block in place; blocks the user deleted
 * (markers gone) or that are new in this app version get appended at the end.
 * User text outside the markers is never touched.
 */
export function mergeNote(existing: string | null, template: NotePart[]): string {
  if (existing === null) {
    return template.map((p) => (p.kind === 'block' ? renderBlock(p) : p.text)).join('\n') + '\n'
  }
  let out = existing
  const missing: BlockPart[] = []
  for (const part of template) {
    if (part.kind !== 'block') continue
    const re = blockRe(part.id)
    if (re.test(out)) {
      out = out.replace(re, renderBlock(part))
    } else {
      missing.push(part)
    }
  }
  if (missing.length > 0) {
    if (!out.endsWith('\n')) out += '\n'
    out += '\n' + missing.map(renderBlock).join('\n\n') + '\n'
  }
  return out
}

/**
 * Merge YAML frontmatter: our keys win, user-added keys survive in place.
 * Obsidian requires frontmatter at byte 0, so it can't live inside a sentinel
 * block. Values are treated as opaque single-line strings.
 */
export function mergeFrontmatter(existing: string | null, ours: Record<string, string>): string {
  const fmBody = (keys: Record<string, string>): string =>
    Object.entries(keys)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
  if (existing === null || !existing.startsWith('---\n')) {
    const fm = `---\n${fmBody(ours)}\n---\n`
    return existing === null ? fm : fm + existing
  }
  const close = existing.indexOf('\n---', 3)
  if (close === -1) return existing // malformed — leave the user's text alone
  const head = existing.slice(4, close)
  const rest = existing.slice(existing.indexOf('\n', close + 1) + 1)
  const seen = new Set<string>()
  const lines: string[] = []
  for (const line of head.split('\n')) {
    const key = line.split(':', 1)[0]?.trim()
    if (key && key in ours) {
      lines.push(`${key}: ${ours[key]}`)
      seen.add(key)
    } else {
      lines.push(line)
    }
  }
  for (const [k, v] of Object.entries(ours)) {
    if (!seen.has(k)) lines.push(`${k}: ${v}`)
  }
  return `---\n${lines.join('\n')}\n---\n${rest}`
}
