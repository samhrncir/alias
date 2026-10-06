import { describe, expect, it } from 'vitest'
import type { Alias } from '../types'
import {
  BLOCK_END,
  BLOCK_HEADER,
  BLOCK_START,
  BlockError,
  applyBlock,
  checkCommand,
  checkName,
  normalize,
  parseAliasLine,
  quoteSingle,
  renderAliasLine,
  renderBlock,
  scanBashrc,
  sortAliases,
  tokenizeRenderedLine,
} from './bashrc'

function alias(name: string, command: string, extra: Partial<Alias> = {}): Alias {
  return { id: `id-${name}`, name, command, description: '', enabled: true, ...extra }
}

describe('checkName', () => {
  it.each(['ll', 'gs', '..', '...', 'k8s', 'git:up', 'a_b', 'c.', 'x-y', 'v1.2', 'a+b', 'n@host', '100%'])(
    'accepts %s',
    (name) => {
      expect(checkName(name)).toBeNull()
    },
  )

  it.each([
    ['', 'empty'],
    ['-rf', 'leading-dash'],
    ['a b', 'invalid-char'],
    ['a/b', 'invalid-char'],
    ['$x', 'invalid-char'],
    ['a=b', 'invalid-char'],
    ["it's", 'invalid-char'],
    ['a;b', 'invalid-char'],
    ['a*', 'invalid-char'],
    ['~', 'invalid-char'],
    ['#x', 'invalid-char'],
    ['{a,b}', 'invalid-char'],
    ['x'.repeat(65), 'too-long'],
  ])('rejects %j as %s', (name, problem) => {
    expect(checkName(name)).toBe(problem)
  })
})

describe('checkCommand', () => {
  it('rejects empty, whitespace-only and multi-line commands', () => {
    expect(checkCommand('')).toBe('empty')
    expect(checkCommand('   ')).toBe('empty')
    expect(checkCommand('a\nb')).toBe('multiline')
    expect(checkCommand('a\r')).toBe('multiline')
    expect(checkCommand('x'.repeat(4001))).toBe('too-long')
  })

  it('accepts surrounding whitespace, which bash treats as meaningful', () => {
    expect(checkCommand('sudo ')).toBeNull()
  })
})

describe('quoteSingle', () => {
  it('wraps in single quotes and escapes embedded quotes', () => {
    expect(quoteSingle('ls -la')).toBe("'ls -la'")
    expect(quoteSingle("it's")).toBe("'it'\\''s'")
    expect(quoteSingle('echo "$HOME" `x` \\n')).toBe('\'echo "$HOME" `x` \\n\'')
  })
})

describe('parseAliasLine', () => {
  const def = (line: string) => {
    const parsed = parseAliasLine(line)
    if (parsed.kind !== 'alias') throw new Error(`expected alias, got ${JSON.stringify(parsed)}`)
    return parsed.def
  }

  it('reads single-quoted, double-quoted and unquoted values', () => {
    expect(def("alias ll='ls -la'")).toEqual({ name: 'll', command: 'ls -la', description: '' })
    expect(def('alias gs="git status -sb"')).toMatchObject({ command: 'git status -sb' })
    expect(def('alias c=clear')).toMatchObject({ name: 'c', command: 'clear' })
  })

  it('reads escaped quotes, concatenated parts and the whole-word quoted form', () => {
    expect(def("alias q='it'\\''s'")).toMatchObject({ command: "it's" })
    expect(def(`alias x='a'"b"c`)).toMatchObject({ command: 'abc' })
    expect(def("alias 'gs=git status'")).toMatchObject({ name: 'gs', command: 'git status' })
    expect(def('alias e="say \\"hi\\""')).toMatchObject({ command: 'say "hi"' })
  })

  it('takes a trailing comment as the description, but not a # inside a value', () => {
    expect(def("alias gs='git status'   #  short   status ")).toMatchObject({ description: 'short status' })
    expect(def("alias h='echo #tag'")).toMatchObject({ command: 'echo #tag', description: '' })
    expect(def('alias h=a#b')).toMatchObject({ command: 'a#b' })
  })

  it('accepts indentation and `alias --`', () => {
    expect(def("    alias ls='ls --color=auto'")).toMatchObject({ name: 'ls' })
    expect(def("alias -- gl='git log'")).toMatchObject({ name: 'gl' })
  })

  it('preserves meaningful whitespace inside the value', () => {
    expect(def("alias sudo='sudo '")).toMatchObject({ command: 'sudo ' })
  })

  it.each(['export PATH=$PATH:~/bin', '# alias x=y', 'alias', 'alias -p', 'alias ll', 'aliasx=y', ''])(
    'ignores %j',
    (line) => {
      expect(parseAliasLine(line)).toEqual({ kind: 'none' })
    },
  )

  it.each([
    ["alias a='x' b='y'", 'several aliases'],
    ["alias a='x'; echo hi", 'more than one command'],
    ['alias p="cd $(git rev-parse --show-toplevel)"', 'expands'],
    ['alias home=~/code', 'expands'],
    ['alias star=ls*', 'expands'],
    ["alias broken='never closed", 'continues'],
    ['alias cont=foo \\', 'continues'],
    ["alias ~='cd ~'", 'name'],
    ["alias a/b='x'", 'name'],
  ])('flags %j as complex', (line, reason) => {
    const parsed = parseAliasLine(line)
    expect(parsed.kind).toBe('complex')
    expect(parsed.kind === 'complex' && parsed.reason).toContain(reason)
  })
})

describe('normalize', () => {
  it('converts CRLF to LF and strips a BOM', () => {
    expect(normalize('\uFEFFa\r\nb\r\n')).toEqual({ text: 'a\nb\n', eol: 'crlf', hadBom: true })
    expect(normalize('a\r\nb\n')).toMatchObject({ text: 'a\nb\n', eol: 'mixed' })
    expect(normalize('a\nb\n')).toEqual({ text: 'a\nb\n', eol: 'lf', hadBom: false })
  })
})

describe('renderBlock', () => {
  it('sorts by name and renders disabled aliases as comments', () => {
    const lines = renderBlock([
      alias('zz', 'echo z'),
      alias('Ab', 'echo b', { description: 'second\nline' }),
      alias('aa', 'echo a', { enabled: false }),
    ])
    expect(lines).toEqual([
      BLOCK_HEADER,
      "# alias aa='echo a'",
      "alias Ab='echo b'  # second line",
      "alias zz='echo z'",
      BLOCK_END,
    ])
  })
})

describe('tokenizeRenderedLine', () => {
  it('splits what renderAliasLine produces', () => {
    const line = renderAliasLine(alias('q', "it's  # not a comment", { description: 'x', enabled: false }))
    expect(tokenizeRenderedLine(line)).toEqual({
      disabled: true,
      name: 'q',
      value: "'it'\\''s  # not a comment'",
      comment: 'x',
    })
    expect(tokenizeRenderedLine(BLOCK_HEADER)).toBeNull()
  })
})

describe('scanBashrc', () => {
  const file = [
    'export EDITOR=vim',
    "alias ll='ls -la'  # long list",
    'if [ -x /usr/bin/dircolors ]; then',
    "    alias ls='ls --color=auto'",
    'fi',
    'alias p="cd $(pwd)"',
    BLOCK_HEADER,
    "alias gs='git status -sb'  # short",
    "# alias old='x'",
    'echo stray',
    BLOCK_END,
    '# alias commented=out',
  ].join('\n')

  it('separates managed, hand-written and complex definitions', () => {
    const scan = scanBashrc(file)
    expect(scan.block).toEqual({ start: 6, end: 10 })
    expect(scan.blockProblem).toBeNull()
    expect(scan.managed.map((a) => [a.name, a.enabled, a.description])).toEqual([
      ['gs', true, 'short'],
      ['old', false, ''],
    ])
    expect(scan.outside.map((a) => [a.name, a.line, a.indented, a.description])).toEqual([
      ['ll', 1, false, 'long list'],
      ['ls', 3, true, ''],
    ])
    expect(scan.complex.map((c) => c.line)).toEqual([5])
  })

  it.each([
    [[BLOCK_START, 'x'], 'unclosed'],
    [[BLOCK_END], 'orphan-end'],
    [[BLOCK_END, BLOCK_START], 'unclosed'],
    [[BLOCK_START, BLOCK_END, BLOCK_START, BLOCK_END], 'duplicate'],
  ])('reports broken markers %j as %s', (lines, problem) => {
    expect(scanBashrc(lines.join('\n')).blockProblem).toBe(problem)
  })
})

describe('applyBlock', () => {
  const library = [alias('gs', 'git status -sb', { description: 'short' }), alias('ll', 'ls -la')]
  const blockText = renderBlock(library).join('\n')

  it('creates the block in an empty file', () => {
    expect(applyBlock('', library)).toBe(`${blockText}\n`)
  })

  it('leaves an empty file alone when there is nothing to write', () => {
    expect(applyBlock('', [])).toBe('')
  })

  it('appends after existing content with one blank line, keeping that content byte-for-byte', () => {
    const before = 'export EDITOR=vim\n  # indented comment\t\n'
    expect(applyBlock(before, library)).toBe(`${before}\n${blockText}\n`)
    expect(applyBlock('PS1=x\n\n', library)).toBe(`PS1=x\n\n${blockText}\n`)
  })

  it('replaces an existing block in place and drops whatever was inside it', () => {
    const before = ['top', BLOCK_HEADER, "alias old='x'", 'junk', BLOCK_END, 'bottom', ''].join('\n')
    expect(applyBlock(before, library)).toBe(`top\n${blockText}\nbottom\n`)
  })

  it('is idempotent', () => {
    const once = applyBlock('export A=1\n', library)
    expect(applyBlock(once, library)).toBe(once)
  })

  it('round-trips through scanBashrc', () => {
    const lib = [...library, alias('off', "echo 'q'", { enabled: false, description: 'paused' })]
    const pick = ({ name, command, description, enabled }: Omit<Alias, 'id'>) => ({ name, command, description, enabled })
    expect(scanBashrc(applyBlock('', lib)).managed.map(pick)).toEqual(sortAliases(lib).map(pick))
  })

  it('normalizes CRLF, a BOM and a missing final newline', () => {
    expect(applyBlock('\uFEFFa\r\nb', library)).toBe(`a\nb\n\n${blockText}\n`)
  })

  it('refuses to touch a file with broken markers', () => {
    expect(() => applyBlock(`${BLOCK_START}\nx\n`, library)).toThrow(BlockError)
  })

  it('removes adopted top-level definitions, but never indented ones or ones not in the library', () => {
    const before = [
      "alias ll='ls -l'",
      "alias keep='x'",
      'if true; then',
      "  alias ll='ls -l'",
      'fi',
      '',
    ].join('\n')
    const after = applyBlock(before, library, ['ll', 'keep'])
    expect(after).toBe(["alias keep='x'", 'if true; then', "  alias ll='ls -l'", 'fi', '', blockText, ''].join('\n'))
  })
})
