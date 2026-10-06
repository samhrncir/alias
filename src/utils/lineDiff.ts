import { diffLines } from 'diff'

export interface LineRow {
  kind: 'same' | 'add' | 'del'
  text: string
  oldNo: number | null
  newNo: number | null
}

export type DiffRow = LineRow | { kind: 'gap'; count: number }

export interface LineDiff {
  rows: DiffRow[]
  added: number
  removed: number
}

function splitLines(value: string): string[] {
  const lines = value.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

/** Line diff with unchanged runs folded down to `context` lines around each change. */
export function lineDiff(before: string, after: string, context = 3): LineDiff {
  const flat: LineRow[] = []
  let oldNo = 1
  let newNo = 1
  let added = 0
  let removed = 0
  for (const part of diffLines(before, after)) {
    for (const text of splitLines(part.value)) {
      if (part.added) {
        flat.push({ kind: 'add', text, oldNo: null, newNo: newNo++ })
        added++
      } else if (part.removed) {
        flat.push({ kind: 'del', text, oldNo: oldNo++, newNo: null })
        removed++
      } else {
        flat.push({ kind: 'same', text, oldNo: oldNo++, newNo: newNo++ })
      }
    }
  }

  const visible = flat.map(() => false)
  flat.forEach((row, i) => {
    if (row.kind === 'same') return
    for (let j = Math.max(0, i - context); j <= Math.min(flat.length - 1, i + context); j++) visible[j] = true
  })

  const rows: DiffRow[] = []
  let gap = 0
  flat.forEach((row, i) => {
    if (!visible[i]) {
      gap++
      return
    }
    if (gap) rows.push({ kind: 'gap', count: gap })
    gap = 0
    rows.push(row)
  })
  if (gap) rows.push({ kind: 'gap', count: gap })
  return { rows, added, removed }
}
