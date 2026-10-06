import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import type { Alias } from '../types'
import { applyBlock, renderBlock } from './bashrc'

/*
 * The real consumer of our output is bash, so check it there instead of
 * trusting our own reading of the quoting rules. Scripts go in on stdin, so
 * this works with Git Bash on Windows as well as on Linux/macOS.
 */

const hasBash = spawnSync('bash', ['--version']).status === 0

function bash(args: string[], script: string) {
  return spawnSync('bash', args, { input: script, encoding: 'utf8' })
}

function alias(name: string, command: string, enabled = true): Alias {
  return { id: name, name, command, description: `about ${name}`, enabled }
}

const tricky: Alias[] = [
  alias('ll', 'ls -la'),
  alias('q1', "echo 'single' it's"),
  alias('q2', 'echo "double $HOME" `date`'),
  alias('bs', 'printf "%s\\n" a\\b c\\\\d'),
  alias('hash', 'echo #not-a-comment # still not'),
  alias('uni', 'echo ✓ → 🚀'),
  alias('sudo', 'sudo '),
  alias('fmt', "git log --format='%h %s'"),
  alias('bang', 'echo hi!'),
  alias('..', 'cd ..'),
  alias('g:s', 'git status'),
  alias('off', 'echo should-not-exist', false),
]

describe.skipIf(!hasBash)('rendered block in real bash', () => {
  it('defines every enabled alias with exactly the stored command', () => {
    const probe = tricky.map((a) => `printf '%s\\0' "\${BASH_ALIASES['${a.name}']-<unset>}"`)
    const result = bash(['-s'], [...renderBlock(tricky), ...probe].join('\n'))
    expect(result.stderr).toBe('')
    const values = result.stdout.split('\0').slice(0, -1)
    expect(values).toEqual(tricky.map((a) => (a.enabled ? a.command : '<unset>')))
  })

  it('produces a file bash can parse', () => {
    const existing = ['export EDITOR=vim', 'if true; then', "  alias ll='ls -l'", 'fi', ''].join('\n')
    const result = bash(['-n'], applyBlock(existing, tricky, ['ll']))
    expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' })
  })
})
