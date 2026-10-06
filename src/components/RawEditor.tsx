import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, Save } from 'lucide-react'
import { EditorView, basicSetup } from 'codemirror'
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { tags } from '@lezer/highlight'
import { normalize } from '../utils/bashrc'

// Colours come from the active theme's CSS variables, so one editor theme serves all three.
const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', color: 'var(--text)', backgroundColor: 'var(--bg)', fontSize: '13.5px' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', fontVariantLigatures: 'none', lineHeight: '1.65' },
    '.cm-content': { caretColor: 'var(--primary)', padding: '10px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--primary)', borderLeftWidth: '2px' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'var(--selection)',
    },
    '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--muted)', border: 'none', borderRight: '1px solid var(--line)' },
    '.cm-activeLine': { backgroundColor: 'var(--primary-soft)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' },
    '.cm-matchingBracket': { color: 'var(--text-strong)', outline: '1px solid var(--line-hi)', backgroundColor: 'transparent' },
    '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--cta) 30%, transparent)' },
    '.cm-panels': { backgroundColor: 'var(--panel)', color: 'var(--text)', borderColor: 'var(--line)' },
    '.cm-tooltip': { backgroundColor: 'var(--panel)', border: '1px solid var(--line-hi)' },
  },
  { dark: true },
)

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword], color: 'var(--primary)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [tags.variableName, tags.definition(tags.variableName), tags.special(tags.variableName)], color: 'var(--accent)' },
  { tag: [tags.standard(tags.variableName), tags.atom], color: 'var(--ok)' },
  { tag: [tags.number, tags.bool], color: 'var(--warn)' },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--muted)' },
  { tag: tags.attributeName, color: 'var(--text-strong)' },
])

interface Props {
  /** The file as it is on disk (or the imported copy). */
  text: string
  fileName: string
  /** In manual mode there's nothing to write to; saving downloads instead. */
  writable: boolean
  onSave: (text: string, openedWith: string) => void
  onDownload: (text: string) => void
}

/** The whole file in CodeMirror. Saving goes through the same diff and backup as alias writes. */
export default function RawEditor({ text, fileName, writable, onSave, onDownload }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  // The disk text the editor was last in step with.
  const baseline = useRef(normalize(text).text)
  const [dirty, setDirty] = useState(false)
  const [diskChanged, setDiskChanged] = useState(false)
  const saveRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!host.current) return
    const editor = new EditorView({
      parent: host.current,
      doc: baseline.current,
      extensions: [
        basicSetup,
        StreamLanguage.define(shell),
        editorTheme,
        syntaxHighlighting(highlight),
        EditorView.contentAttributes.of({ 'aria-label': 'File contents', spellcheck: 'false' }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) setDirty(update.state.doc.toString() !== baseline.current)
        }),
      ],
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
  }, [])

  // The file changed on disk (our own save, a re-read, or another editor).
  useEffect(() => {
    const editor = view.current
    const disk = normalize(text).text
    if (!editor || disk === baseline.current) return
    const current = editor.state.doc.toString()
    if (current === disk) {
      baseline.current = disk
      setDirty(false)
      setDiskChanged(false)
    } else if (current === baseline.current) {
      baseline.current = disk
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: disk } })
      setDirty(false)
    } else {
      setDiskChanged(true)
    }
  }, [text])

  function replaceDoc(content: string) {
    const editor = view.current
    if (editor) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: content } })
  }

  function loadDisk() {
    baseline.current = normalize(text).text
    replaceDoc(baseline.current)
    setDirty(false)
    setDiskChanged(false)
  }

  function save() {
    const doc = view.current?.state.doc.toString()
    if (doc === undefined) return
    if (writable) onSave(doc, baseline.current)
    else onDownload(doc)
  }

  useEffect(() => {
    saveRef.current = save
  })

  // Ctrl/Cmd+S saves while this tab is open, whether or not the editor has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      if (!document.querySelector('dialog[open]')) saveRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="panel" aria-labelledby="raw-title">
      <header className="panel-head">
        <h2 id="raw-title">
          <span className="kicker">//</span> Raw file
        </h2>
        <code className="chip">{fileName}</code>
      </header>
      {diskChanged && (
        <div className="callout callout-warn row">
          <span>The file changed on disk while you were editing.</span>
          <button type="button" className="btn btn-sm" onClick={loadDisk}>
            Load the disk version
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDiskChanged(false)}>
            Keep my edits
          </button>
        </div>
      )}
      <div className="raw-host" ref={host} />
      <div className="raw-foot">
        <span className="muted">{dirty ? '● unsaved changes' : 'matches the file on disk'}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => replaceDoc(baseline.current)} disabled={!dirty}>
          <RotateCcw size={14} /> Revert
        </button>
        <button type="button" className="btn btn-cta btn-sm" onClick={save} disabled={!dirty}>
          {writable ? (
            <>
              <Save size={14} /> Save file…
            </>
          ) : (
            <>
              <Download size={14} /> Download edited file
            </>
          )}
        </button>
      </div>
    </section>
  )
}
