import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { MAX_SNAPSHOTS, listSnapshots, saveSnapshot } from './snapshots'

beforeEach(async () => {
  await (await db()).clear('snapshots')
})

describe('snapshots', () => {
  it('lists newest first and keeps only the latest MAX_SNAPSHOTS', async () => {
    for (let i = 1; i <= MAX_SNAPSHOTS + 5; i++) await saveSnapshot('.bashrc', 'write', `v${i}`)
    const list = await listSnapshots()
    expect(list).toHaveLength(MAX_SNAPSHOTS)
    expect(list[0]?.content).toBe(`v${MAX_SNAPSHOTS + 5}`)
    expect(list.at(-1)?.content).toBe('v6')
  })

  it('records what was saved and why', async () => {
    const saved = await saveSnapshot('.bashrc', 'raw', 'export A=1\n')
    expect(saved).toMatchObject({ fileName: '.bashrc', reason: 'raw', content: 'export A=1\n' })
    expect(Number.isNaN(Date.parse(saved.takenAt))).toBe(false)
    expect(await listSnapshots()).toEqual([saved])
  })
})
