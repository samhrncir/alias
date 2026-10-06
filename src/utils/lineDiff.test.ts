import { describe, expect, it } from 'vitest'
import { lineDiff } from './lineDiff'

const lines = (n: number, prefix = 'line') => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`)

describe('lineDiff', () => {
  it('numbers added and removed lines against each side', () => {
    const { rows, added, removed } = lineDiff('a\nb\nc\n', 'a\nB\nc\nd\n')
    expect(added).toBe(2)
    expect(removed).toBe(1)
    expect(rows).toEqual([
      { kind: 'same', text: 'a', oldNo: 1, newNo: 1 },
      { kind: 'del', text: 'b', oldNo: 2, newNo: null },
      { kind: 'add', text: 'B', oldNo: null, newNo: 2 },
      { kind: 'same', text: 'c', oldNo: 3, newNo: 3 },
      { kind: 'add', text: 'd', oldNo: null, newNo: 4 },
    ])
  })

  it('folds long unchanged runs into gaps', () => {
    const before = [...lines(20), ''].join('\n')
    const after = [...lines(20).map((l) => (l === 'line 10' ? 'changed' : l)), ''].join('\n')
    const { rows } = lineDiff(before, after, 2)
    expect(rows[0]).toEqual({ kind: 'gap', count: 7 })
    expect(rows.at(-1)).toEqual({ kind: 'gap', count: 8 })
    expect(rows.filter((r) => r.kind !== 'gap')).toHaveLength(6)
  })

  it('collapses identical input to a single gap', () => {
    expect(lineDiff('a\nb\n', 'a\nb\n').rows).toEqual([{ kind: 'gap', count: 2 }])
  })
})
