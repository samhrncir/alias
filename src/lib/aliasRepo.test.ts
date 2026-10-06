import { describe, expect, it } from 'vitest'
import { LOCAL_KEY, localRepo, readLocal, sanitizeAliases } from './aliasRepo'

describe('sanitizeAliases', () => {
  it('drops malformed entries and duplicate names, fills defaults, and sorts', () => {
    expect(
      sanitizeAliases([
        { id: '2', name: 'zz', command: 'z' },
        { id: '1', name: 'aa', command: 'a', description: ' multi\nline ', enabled: false },
        { id: '3', name: 'aa', command: 'duplicate name' },
        { id: '4', name: 'bad name', command: 'x' },
        { id: '5', name: 'blank', command: '  ' },
        { name: 'no-id', command: 'x' },
        null,
        'junk',
      ]),
    ).toEqual([
      { id: '1', name: 'aa', command: 'a', description: 'multi line', enabled: false },
      { id: '2', name: 'zz', command: 'z', description: '', enabled: true },
    ])
    expect(sanitizeAliases({ not: 'an array' })).toEqual([])
  })
})

describe('localRepo', () => {
  it('saves the whole library and reads it back', async () => {
    const library = [{ id: '1', name: 'll', command: 'ls -la', description: '', enabled: true }]
    await localRepo.apply({ upserted: library, removedIds: [] }, library)
    expect(await localRepo.list()).toEqual(library)
  })

  it('treats corrupt storage as an empty library', () => {
    localStorage.setItem(LOCAL_KEY, '{oops')
    expect(readLocal()).toEqual([])
  })
})
