import type { Alias } from '../types'

/*
 * Reading and writing ~/.bashrc.
 *
 * Alias owns one region of the file, between BLOCK_START and BLOCK_END, and
 * regenerates it from the library on every write. Lines outside the block are
 * kept as they are. The one exception is adopting an alias: its original
 * top-level line is removed, and only when the caller names it explicitly.
 *
 * Parsing is deliberately conservative. An alias line we can't read with
 * certainty is reported as "complex" and never modified.
 */

export const BLOCK_START = '# >>> ALIAS >>>'
export const BLOCK_END = '# <<< ALIAS <<<'
export const BLOCK_HEADER = `${BLOCK_START} managed by Alias - changes inside this block are overwritten`

export const NAME_MAX = 64
export const COMMAND_MAX = 4000
export const DESCRIPTION_MAX = 200

/*
 * Stricter than bash on purpose. Bash already forbids / $ ` = quotes and
 * metacharacters in alias names; this also keeps out globs, braces, tildes
 * and #, so the unquoted name in `alias NAME='...'` can never expand or turn
 * into a comment.
 */
const NAME_PATTERN = /^[A-Za-z0-9_.:@%+,][A-Za-z0-9_.:@%+,-]*$/

export type NameProblem = 'empty' | 'too-long' | 'leading-dash' | 'invalid-char'
export type CommandProblem = 'empty' | 'too-long' | 'multiline'

export function checkName(name: string): NameProblem | null {
  if (name.length === 0) return 'empty'
  if (name.length > NAME_MAX) return 'too-long'
  if (name.startsWith('-')) return 'leading-dash'
  if (!NAME_PATTERN.test(name)) return 'invalid-char'
  return null
}

/** Commands are never trimmed: a trailing space changes how bash expands the alias. */
export function checkCommand(command: string): CommandProblem | null {
  if (command.trim().length === 0) return 'empty'
  if (command.length > COMMAND_MAX) return 'too-long'
  if (/[\r\n]/.test(command)) return 'multiline'
  return null
}

/** Collapses whitespace so text can live in a one-line `# comment`. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Single-quotes a value for bash; a literal ' becomes '\'' (close, escaped quote, reopen). */
export function quoteSingle(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

// ---- line parsing ---------------------------------------------------------

interface Lexed {
  words: string[]
  comment: string | null
  /** Unquoted ; & | < > ( ): more than a single simple command. */
  operator: boolean
  /** Something bash would expand while defining the alias: $, `, globs, ~, {. */
  expansion: boolean
  /** Unterminated quote or trailing backslash: the statement continues on the next line. */
  continues: boolean
}

const OPERATOR_CHARS = ';&|<>()'
const EXPANSION_CHARS = '$`*?[~{'
const DQUOTE_ESCAPABLE = '$`"\\'

function flush(words: string[], word: string | null): null {
  if (word !== null) words.push(word)
  return null
}

/** Splits one line into shell words the way bash would, without expanding anything. */
function lex(input: string): Lexed {
  const out: Lexed = { words: [], comment: null, operator: false, expansion: false, continues: false }
  let word: string | null = null
  let i = 0
  while (i < input.length) {
    const ch = input.charAt(i)
    if (ch === ' ' || ch === '\t') {
      word = flush(out.words, word)
      i++
      continue
    }
    if (ch === '#' && word === null) {
      out.comment = input.slice(i + 1)
      break
    }
    if (OPERATOR_CHARS.includes(ch)) {
      out.operator = true
      word = flush(out.words, word)
      i++
      continue
    }
    word ??= ''
    if (ch === '\\') {
      if (i + 1 >= input.length) {
        out.continues = true
        break
      }
      word += input.charAt(i + 1)
      i += 2
      continue
    }
    if (ch === "'") {
      const close = input.indexOf("'", i + 1)
      if (close === -1) {
        out.continues = true
        break
      }
      word += input.slice(i + 1, close)
      i = close + 1
      continue
    }
    if (ch === '"') {
      let j = i + 1
      let closed = false
      while (j < input.length) {
        const c = input.charAt(j)
        if (c === '"') {
          closed = true
          break
        }
        if (c === '\\' && j + 1 < input.length && DQUOTE_ESCAPABLE.includes(input.charAt(j + 1))) {
          word += input.charAt(j + 1)
          j += 2
          continue
        }
        if (c === '$' || c === '`') out.expansion = true
        word += c
        j++
      }
      if (!closed) {
        out.continues = true
        break
      }
      i = j + 1
      continue
    }
    if (EXPANSION_CHARS.includes(ch)) out.expansion = true
    word += ch
    i++
  }
  flush(out.words, word)
  return out
}

export interface AliasDefinition {
  name: string
  command: string
  description: string
}

export type LineParse =
  | { kind: 'none' }
  | { kind: 'alias'; def: AliasDefinition }
  | { kind: 'complex'; reason: string }

const ALIAS_STATEMENT = /^\s*alias(?=\s)/

function complex(reason: string): LineParse {
  return { kind: 'complex', reason }
}

/**
 * Reads `alias NAME=VALUE  # comment` (any quoting, optional indent).
 * 'none' means the line isn't an alias definition at all; 'complex' means it
 * is one, but not in a form we can take over safely.
 */
export function parseAliasLine(line: string): LineParse {
  const prefix = ALIAS_STATEMENT.exec(line)
  if (!prefix) return { kind: 'none' }
  const lexed = lex(line.slice(prefix[0].length))
  if (lexed.continues) return complex('continues onto the next line')
  if (lexed.operator) return complex('has more than one command on the line')
  const words = lexed.words[0] === '--' ? lexed.words.slice(1) : lexed.words
  const first = words[0]
  // `alias`, `alias -p` and `alias ll` list aliases instead of defining one.
  if (first === undefined || first.startsWith('-') || !words.some((w) => w.includes('='))) {
    return { kind: 'none' }
  }
  if (words.length > 1) return complex('defines several aliases on one line')
  const eq = first.indexOf('=')
  const name = first.slice(0, eq)
  const command = first.slice(eq + 1)
  if (checkName(name)) return complex(`uses a name Alias doesn't manage ("${name}")`)
  if (lexed.expansion) return complex('expands $, ` or wildcards when it is defined')
  if (checkCommand(command)) return complex('has an empty or multi-line command')
  return { kind: 'alias', def: { name, command, description: oneLine(lexed.comment ?? '') } }
}

// ---- whole-file scan ------------------------------------------------------

export type LineEndings = 'lf' | 'crlf' | 'mixed'

export interface Normalized {
  /** LF line endings, no byte-order mark. */
  text: string
  eol: LineEndings
  hadBom: boolean
}

/** Bash in Git Bash chokes on CRLF and on a BOM, so output always uses plain LF. */
export function normalize(raw: string): Normalized {
  const hadBom = raw.charCodeAt(0) === 0xfeff
  const body = hadBom ? raw.slice(1) : raw
  const crlf = body.split('\r\n').length - 1
  const lf = body.split('\n').length - 1 - crlf
  const eol: LineEndings = crlf === 0 ? 'lf' : lf === 0 ? 'crlf' : 'mixed'
  return { text: crlf ? body.replaceAll('\r\n', '\n') : body, eol, hadBom }
}

function toLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function fromLines(lines: readonly string[]): string {
  return lines.length ? `${lines.join('\n')}\n` : ''
}

export type BlockProblem = 'unclosed' | 'orphan-end' | 'duplicate'

export function describeBlockProblem(problem: BlockProblem): string {
  switch (problem) {
    case 'unclosed':
      return `The file has "${BLOCK_START}" without a matching "${BLOCK_END}" after it.`
    case 'orphan-end':
      return `The file has "${BLOCK_END}" without a "${BLOCK_START}" before it.`
    case 'duplicate':
      return 'The file has more than one ALIAS block.'
  }
}

export class BlockError extends Error {
  readonly problem: BlockProblem

  constructor(problem: BlockProblem) {
    super(describeBlockProblem(problem))
    this.name = 'BlockError'
    this.problem = problem
  }
}

export interface ScannedAlias extends AliasDefinition {
  enabled: boolean
  /** 0-based index into BashrcScan.lines. */
  line: number
  indented: boolean
  inBlock: boolean
}

export interface ComplexAlias {
  line: number
  text: string
  reason: string
}

export interface BashrcScan {
  lines: string[]
  block: { start: number; end: number } | null
  blockProblem: BlockProblem | null
  /** Definitions inside the ALIAS block, in file order. */
  managed: ScannedAlias[]
  /** Hand-written definitions outside the block that we can read. */
  outside: ScannedAlias[]
  /** Alias lines outside the block that we leave alone. */
  complex: ComplexAlias[]
  eol: LineEndings
  hadBom: boolean
}

function locateBlock(lines: readonly string[]): Pick<BashrcScan, 'block' | 'blockProblem'> {
  const starts: number[] = []
  const ends: number[] = []
  lines.forEach((line, i) => {
    if (line.startsWith(BLOCK_START)) starts.push(i)
    else if (line.startsWith(BLOCK_END)) ends.push(i)
  })
  const [start] = starts
  const [end] = ends
  if (start === undefined && end === undefined) return { block: null, blockProblem: null }
  if (starts.length > 1 || ends.length > 1) return { block: null, blockProblem: 'duplicate' }
  if (start === undefined) return { block: null, blockProblem: 'orphan-end' }
  if (end === undefined || end < start) return { block: null, blockProblem: 'unclosed' }
  return { block: { start, end }, blockProblem: null }
}

const DISABLED_LINE = /^#\s*(alias\s.*)$/

export function scanBashrc(raw: string): BashrcScan {
  const { text, eol, hadBom } = normalize(raw)
  const lines = toLines(text)
  const { block, blockProblem } = locateBlock(lines)
  const managed: ScannedAlias[] = []
  const outside: ScannedAlias[] = []
  const complexLines: ComplexAlias[] = []

  lines.forEach((line, i) => {
    if (block && i >= block.start && i <= block.end) {
      if (i === block.start || i === block.end) return
      // Inside the block a commented-out definition is a disabled alias.
      const disabled = DISABLED_LINE.exec(line)
      const parsed = parseAliasLine(disabled?.[1] ?? line)
      if (parsed.kind === 'alias') {
        managed.push({ ...parsed.def, enabled: !disabled, line: i, indented: false, inBlock: true })
      }
      return
    }
    const parsed = parseAliasLine(line)
    if (parsed.kind === 'alias') {
      outside.push({ ...parsed.def, enabled: true, line: i, indented: /^\s/.test(line), inBlock: false })
    } else if (parsed.kind === 'complex') {
      complexLines.push({ line: i, text: line, reason: parsed.reason })
    }
  })

  return { lines, block, blockProblem, managed, outside, complex: complexLines, eol, hadBom }
}

// ---- rendering ------------------------------------------------------------

export function sortAliases<T extends { name: string }>(aliases: readonly T[]): T[] {
  return [...aliases].sort((a, b) => {
    const x = a.name.toLowerCase()
    const y = b.name.toLowerCase()
    if (x !== y) return x < y ? -1 : 1
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  })
}

type Renderable = Pick<Alias, 'name' | 'command' | 'description' | 'enabled'>

export function renderAliasLine(alias: Renderable): string {
  const definition = `alias ${alias.name}=${quoteSingle(alias.command)}`
  const note = oneLine(alias.description)
  const line = note ? `${definition}  # ${note}` : definition
  return alias.enabled ? line : `# ${line}`
}

export function renderBlock(aliases: readonly Renderable[]): string[] {
  return [BLOCK_HEADER, ...sortAliases(aliases).map(renderAliasLine), BLOCK_END]
}

export interface LineTokens {
  disabled: boolean
  name: string
  value: string
  comment: string
}

const RENDERED_LINE = /^(# )?alias ([^=]+)=('(?:[^']|'\\'')*')(?: {2}# (.*))?$/

/** Splits a line produced by renderAliasLine into parts for syntax colouring. */
export function tokenizeRenderedLine(line: string): LineTokens | null {
  const m = RENDERED_LINE.exec(line)
  if (!m) return null
  return { disabled: m[1] !== undefined, name: m[2] ?? '', value: m[3] ?? '', comment: m[4] ?? '' }
}

/**
 * Returns the file with the ALIAS block regenerated from `aliases`.
 *
 * `adopt` names aliases whose hand-written top-level definitions outside the
 * block should be removed because the block now defines them. Indented
 * definitions may sit inside an if/function body, so they always stay.
 */
export function applyBlock(raw: string, aliases: readonly Alias[], adopt: Iterable<string> = []): string {
  const scan = scanBashrc(raw)
  if (scan.blockProblem) throw new BlockError(scan.blockProblem)

  const defined = new Set(aliases.map((a) => a.name))
  const adopted = new Set([...adopt].filter((name) => defined.has(name)))
  const remove = new Set(scan.outside.filter((a) => !a.indented && adopted.has(a.name)).map((a) => a.line))
  const block = renderBlock(aliases)

  const out: string[] = []
  scan.lines.forEach((line, i) => {
    if (scan.block && i === scan.block.start) out.push(...block)
    if (scan.block && i >= scan.block.start && i <= scan.block.end) return
    if (!remove.has(i)) out.push(line)
  })
  if (!scan.block && aliases.length > 0) {
    if (out.length > 0 && out.at(-1)?.trim() !== '') out.push('')
    out.push(...block)
  }
  return fromLines(out)
}
