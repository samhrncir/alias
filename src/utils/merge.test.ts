import { describe, expect, it } from 'vitest'
import type { Alias } from '../types'
import { BLOCK_END, BLOCK_HEADER, scanBashrc } from './bashrc'
import { compareWithBlock, importedAliases, planCloudUpload, planImport } from './merge'

function alias(name: string, command: string, extra: Partial<Alias> = {}): Alias {
  return { id: `id-${name}`, name, command, description: '', enabled: true, ...extra }
}

let counter = 0
const newId = () => `new-${++counter}`

describe('planImport', () => {
  const file = [
    "alias ll='ls -l'",
    "alias gs='git status'",
    'if true; then',
    "  alias ll='ls -la'",
    'fi',
    BLOCK_HEADER,
    "alias dc='docker compose'  # compose",
    "# alias off='x'",
    BLOCK_END,
  ].join('\n')

  it('classifies each name found in the file against the library', () => {
    const library = [alias('gs', 'git status'), alias('dc', 'docker-compose')]
    const plan = planImport(library, scanBashrc(file))
    expect(plan.map((c) => [c.name, c.status])).toEqual([
      ['dc', 'changed'],
      ['gs', 'same'],
      ['ll', 'new'],
      ['off', 'new'],
    ])
  })

  it('uses the definition bash ends up with and tracks which lines can move', () => {
    const ll = planImport([], scanBashrc(file)).find((c) => c.name === 'll')
    expect(ll?.incoming.command).toBe('ls -la')
    expect(ll?.movableLines).toEqual([0])
    expect(ll?.stayingLines).toEqual([3])
  })

  it('keeps disabled block entries disabled', () => {
    const off = planImport([], scanBashrc(file)).find((c) => c.name === 'off')
    expect(off?.incoming.enabled).toBe(false)
  })

  it('does not count a missing comment as a change', () => {
    const library = [alias('gs', 'git status', { description: 'status' })]
    const gs = planImport(library, scanBashrc("alias gs='git status'")).find((c) => c.name === 'gs')
    expect(gs?.status).toBe('same')
  })
})

describe('importedAliases', () => {
  it('creates new aliases and updates changed ones, keeping ids and old descriptions', () => {
    const library = [alias('dc', 'docker-compose', { description: 'old note' })]
    const plan = planImport(library, scanBashrc("alias dc='docker compose'\nalias ll='ls -l'"))
    const out = importedAliases(plan, newId)
    expect(out).toEqual([
      { id: 'id-dc', name: 'dc', command: 'docker compose', description: 'old note', enabled: true },
      { id: expect.stringMatching(/^new-/), name: 'll', command: 'ls -l', description: '', enabled: true },
    ])
  })
})

describe('planCloudUpload', () => {
  it('uploads missing names with fresh ids and reports conflicting ones', () => {
    const local = [alias('a', 'x'), alias('b', 'y'), alias('c', 'z')]
    const cloud = [alias('b', 'y'), alias('c', 'different')]
    const plan = planCloudUpload(local, cloud, newId)
    expect(plan.upload.map((a) => a.name)).toEqual(['a'])
    expect(plan.upload[0]?.id).not.toBe('id-a')
    expect(plan.conflicts).toEqual(['c'])
  })
})

describe('compareWithBlock', () => {
  it('reports new, edited and removed aliases', () => {
    const scan = scanBashrc(
      [BLOCK_HEADER, "alias a='x'", "alias b='old'", "alias gone='z'", BLOCK_END].join('\n'),
    )
    const library = [alias('a', 'x'), alias('b', 'new'), alias('c', 'w')]
    const result = compareWithBlock(library, scan.managed)
    expect(Object.fromEntries(result.byName)).toEqual({ a: 'synced', b: 'edited', c: 'new' })
    expect(result.removed).toEqual(['gone'])
    expect(result.changes).toBe(3)
  })
})
