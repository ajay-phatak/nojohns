import { describe, it, expect } from 'vitest'
import { parseAdvice } from './advise'

const REPORT = `Progress check: OOS punish % moved 43% -> 51% since you committed to shine OOS.

Headline: 2-1 vs Fox, but the reversal ledger decided game three.

How do you want to address these?

\`\`\`json
{"gaps": [
  {"gap": "Reversal cost", "evidence": "3 reversals, 51%/ea + 2 stocks", "suggestion": "Cap combo extensions at 2 hits past 80%."},
  {"gap": "Free recoveries", "evidence": "44% uncontested (29/66)", "suggestion": "Always move toward the ledge on their recovery, even without a read."}
]}
\`\`\`
`

describe('parseAdvice', () => {
  it('splits prose from the trailing json block', () => {
    const { prose, gaps } = parseAdvice(REPORT)
    expect(prose).toContain('reversal ledger decided game three')
    expect(prose).not.toContain('```json')
    expect(gaps).toHaveLength(2)
    expect(gaps[0].gap).toBe('Reversal cost')
    expect(gaps[1].suggestion).toContain('move toward the ledge')
  })

  it('returns full text and no gaps when the block is missing', () => {
    const { prose, gaps } = parseAdvice('Just prose, no machine block.')
    expect(prose).toBe('Just prose, no machine block.')
    expect(gaps).toHaveLength(0)
  })

  it('survives malformed json', () => {
    const { prose, gaps } = parseAdvice('Read here.\n\n```json\n{not valid\n```')
    expect(prose).toBe('Read here.')
    expect(gaps).toHaveLength(0)
  })

  it('drops entries missing required fields', () => {
    const { gaps } = parseAdvice(
      'x\n\n```json\n{"gaps": [{"gap": "ok", "suggestion": "fine"}, {"gap": 5}, "junk"]}\n```'
    )
    expect(gaps).toHaveLength(1)
    expect(gaps[0].evidence).toBe('')
  })
})
