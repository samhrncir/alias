import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import { AccountDialog } from './components/AccountDialog'
import { AliasEditor } from './components/AliasEditor'
import { AliasTable } from './components/AliasTable'
import { BackupsPanel } from './components/BackupsPanel'
import { BlockPanel } from './components/BlockPanel'
import { Boot } from './components/Boot'
import { DiffDialog } from './components/DiffDialog'
import { FileScanPanel } from './components/FileScanPanel'
import { ImportDialog } from './components/ImportDialog'
import { LinkPanel } from './components/LinkPanel'
import { StatusBar } from './components/StatusBar'
import { TopBar } from './components/TopBar'
import { UploadDialog } from './components/UploadDialog'
import { useAuth } from './hooks/useAuth'
import { StaleFileError, useBashrcLink } from './hooks/useBashrcLink'
import { useGuestUpload } from './hooks/useGuestUpload'
import { useHotkeys } from './hooks/useHotkeys'
import { useLibrary } from './hooks/useLibrary'
import { useTheme } from './hooks/useTheme'
import { useToast } from './hooks/useToast'
import { clearCloudCache } from './lib/aliasRepo'
import type { Snapshot } from './lib/db'
import { downloadText } from './lib/fileAccess'
import type { Alias, WritePlan } from './types'
import { BlockError, applyBlock, normalize, renderBlock, scanBashrc } from './utils/bashrc'
import { errorMessage } from './utils/errors'
import { aliasCount, formatStamp } from './utils/format'
import { compareWithBlock, importedAliases, planImport, type ImportCandidate } from './utils/merge'

const RawEditor = lazy(() => import('./components/RawEditor'))

type Tab = 'aliases' | 'raw' | 'backups'

const TABS: { id: Tab; label: string }[] = [
  { id: 'aliases', label: 'Aliases' },
  { id: 'raw', label: 'Raw file' },
  { id: 'backups', label: 'Backups' },
]

const STARTER: Omit<Alias, 'id'>[] = [
  { name: 'll', command: 'ls -la', description: 'long listing, hidden files too', enabled: true },
  { name: 'gs', command: 'git status', description: '', enabled: true },
  { name: '..', command: 'cd ..', description: 'up one folder', enabled: true },
]

/** What a write changes beyond the content itself. */
function formatNotices(before: string): string[] {
  const { eol, hadBom } = normalize(before)
  const notices: string[] = []
  if (eol !== 'lf') notices.push('Converts Windows (CRLF) line endings to LF; Git Bash fails on CRLF scripts.')
  if (hadBom) notices.push('Removes the UTF-8 byte-order mark, which bash would read as part of the first command.')
  return notices
}

export default function App() {
  const toast = useToast()
  const { theme, setTheme, cycle } = useTheme()
  const auth = useAuth()
  const userId = auth.ready ? (auth.session?.user.id ?? null) : null
  const library = useLibrary(userId)
  const guest = useGuestUpload(userId, library)
  const link = useBashrcLink()

  const [tab, setTab] = useState<Tab>('aliases')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Alias | 'new' | null>(null)
  const [plan, setPlan] = useState<WritePlan | null>(null)
  const [importing, setImporting] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [backupsVersion, setBackupsVersion] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const { scan } = link
  const blockProblem = scan?.blockProblem ?? null
  const comparison = useMemo(
    () => (scan && !blockProblem ? compareWithBlock(library.aliases, scan.managed) : null),
    [scan, blockProblem, library.aliases],
  )
  const candidates = useMemo(() => (scan ? planImport(library.aliases, scan) : []), [scan, library.aliases])
  const pending = useMemo(
    () => link.text !== null && !blockProblem && applyBlock(link.text, library.aliases) !== link.text,
    [link.text, blockProblem, library.aliases],
  )
  const writable = link.status === 'ready' || link.status === 'needs-permission'
  const writeBlocker = !writable ? 'Link a file to write' : blockProblem ? 'Fix the block markers first' : null

  function fail(err: unknown) {
    toast({ tone: 'error', text: errorMessage(err) })
  }

  // ---- library ----------------------------------------------------------

  async function saveAlias(alias: Alias): Promise<void> {
    await library.commit({ upserted: [alias], removedIds: [] })
  }

  function toggleAlias(alias: Alias) {
    saveAlias({ ...alias, enabled: !alias.enabled }).catch(fail)
  }

  function deleteAlias(alias: Alias) {
    library.commit({ upserted: [], removedIds: [alias.id] }).then(
      () =>
        toast({
          tone: 'info',
          text: `Deleted ${alias.name}.`,
          action: { label: 'Undo', run: () => void saveAlias(alias).catch(fail) },
        }),
      fail,
    )
  }

  function addStarter() {
    const taken = new Set(library.aliases.map((a) => a.name))
    const fresh = STARTER.filter((s) => !taken.has(s.name)).map((s) => ({ ...s, id: crypto.randomUUID() }))
    library.commit({ upserted: fresh, removedIds: [] }).then(() => toast({ tone: 'ok', text: `Added ${aliasCount(fresh.length)}.` }), fail)
  }

  // ---- the file: every write is previewed as a diff first ---------------

  async function planBlockWrite(aliases: readonly Alias[] = library.aliases, adopt: string[] = []) {
    try {
      const before = await link.readForWrite()
      const after = applyBlock(before, aliases, adopt)
      if (after === before) {
        toast({ tone: 'ok', text: 'Already in sync. Nothing to write.' })
        return
      }
      const name = link.fileName ?? '.bashrc'
      setPlan({
        kicker: '// BURN TO DISK',
        title: `Write to ${name}`,
        before,
        after,
        reason: 'write',
        notices: formatNotices(before),
        confirmLabel: 'Write file',
        success: `Wrote ${aliasCount(aliases.length)} to ${name}. Run source ~/.bashrc in shells that are already open.`,
      })
    } catch (err) {
      fail(err instanceof BlockError ? `${err.message} Fix it in the Raw tab.` : err)
    }
  }

  async function planRawSave(text: string, openedWith: string) {
    try {
      const before = await link.readForWrite()
      if (before === text) {
        toast({ tone: 'ok', text: 'No changes to save.' })
        return
      }
      const notices = formatNotices(before)
      if (normalize(before).text !== openedWith) {
        notices.unshift('The file changed on disk after you opened it. Saving replaces those changes.')
      }
      const name = link.fileName ?? '.bashrc'
      setPlan({
        kicker: '// RAW WRITE',
        title: `Save ${name}`,
        before,
        after: text,
        reason: 'raw',
        notices,
        confirmLabel: 'Save file',
        success: `Saved ${name}.`,
      })
    } catch (err) {
      fail(err)
    }
  }

  async function planRestore(snapshot: Snapshot) {
    try {
      const before = await link.readForWrite()
      if (before === snapshot.content) {
        toast({ tone: 'ok', text: 'The file already matches that backup.' })
        return
      }
      setPlan({
        kicker: '// ROLLBACK',
        title: `Restore the backup from ${formatStamp(snapshot.takenAt)}`,
        before,
        after: snapshot.content,
        reason: 'restore',
        notices: [],
        confirmLabel: 'Restore file',
        success: 'Backup restored.',
      })
    } catch (err) {
      fail(err)
    }
  }

  function compareSnapshot(snapshot: Snapshot) {
    setPlan({
      kicker: '// DIFF',
      title: 'Backup → the file now',
      before: snapshot.content,
      after: link.text ?? '',
      reason: 'restore',
      notices: [],
      confirmLabel: '',
      success: '',
      readOnly: true,
    })
  }

  async function confirmPlan() {
    if (!plan || plan.readOnly) return
    try {
      await link.commit(plan.before, plan.after, plan.reason)
    } catch (err) {
      // Anything else is shown inside the dialog.
      if (!(err instanceof StaleFileError)) throw err
      setPlan(null)
      toast({ tone: 'warn', text: err.message })
      return
    }
    setPlan(null)
    setBackupsVersion((v) => v + 1)
    toast({ tone: 'ok', text: plan.success })
  }

  function hasNewAliases(text: string): boolean {
    return planImport(library.aliases, scanBashrc(text)).some((c) => c.status === 'new')
  }

  async function linkFile(kind: 'existing' | 'new') {
    try {
      const text = await link.link(kind)
      if (text === null) return
      if (hasNewAliases(text)) setImporting(true)
      else toast({ tone: 'ok', text: 'Linked. This browser will remember the file.' })
    } catch (err) {
      fail(err)
    }
  }

  async function importCopy() {
    try {
      const text = await link.importCopy()
      if (text !== null && hasNewAliases(text)) setImporting(true)
    } catch (err) {
      fail(err)
    }
  }

  async function confirmImport(picked: ImportCandidate[], moveOriginals: boolean) {
    const fresh = importedAliases(picked, () => crypto.randomUUID())
    const next = fresh.length > 0 ? await library.commit({ upserted: fresh, removedIds: [] }) : library.aliases
    setImporting(false)
    if (fresh.length > 0) toast({ tone: 'ok', text: `Imported ${aliasCount(fresh.length)} into your library.` })
    const adopt = picked.filter((c) => c.movableLines.length > 0).map((c) => c.name)
    if (moveOriginals && adopt.length > 0) await planBlockWrite(next, adopt)
  }

  async function copyBlock() {
    try {
      await navigator.clipboard.writeText(`${renderBlock(library.aliases).join('\n')}\n`)
      toast({ tone: 'ok', text: 'Block copied. Paste it at the end of your .bashrc.' })
    } catch {
      toast({ tone: 'error', text: "Couldn't copy to the clipboard." })
    }
  }

  function downloadUpdated() {
    try {
      downloadText('bashrc', applyBlock(link.text ?? '', library.aliases))
      toast({ tone: 'info', text: 'Saved as "bashrc". Rename it to .bashrc and put it in your home folder.' })
    } catch (err) {
      fail(err)
    }
  }

  // ---- account ------------------------------------------------------------

  async function signOut() {
    const id = userId
    await auth.signOut()
    if (id) clearCloudCache(id)
    setAccountOpen(false)
    toast({ tone: 'info', text: "Signed out. You're seeing this browser's library." })
  }

  async function uploadLocal() {
    const count = await guest.upload()
    toast({ tone: 'ok', text: `Uploaded ${aliasCount(count)} to your account.` })
  }

  useHotkeys({
    '/': () => {
      setTab('aliases')
      requestAnimationFrame(() => searchRef.current?.focus())
    },
    n: () => setEditing('new'),
    t: cycle,
    // The Raw tab handles its own Ctrl+S.
    'mod+s':
      tab === 'raw'
        ? undefined
        : () => {
            if (writeBlocker) toast({ tone: 'info', text: `${writeBlocker}.` })
            else void planBlockWrite()
          },
  })

  if (!auth.ready) return <Boot />

  const editingAlias = editing === 'new' ? null : editing
  const takenNames = new Set(library.aliases.filter((a) => a.id !== editingAlias?.id).map((a) => a.name))
  const dialogOpen = editing !== null || plan !== null || importing || accountOpen

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true">
        <div className="atmo-sun" />
        <div className="atmo-floor" />
      </div>

      <TopBar
        theme={theme}
        onTheme={setTheme}
        cloudConfigured={auth.configured}
        email={auth.session?.user.email ?? null}
        onAccount={() => setAccountOpen(true)}
      />

      <main className="layout">
        <aside className="sidebar" aria-label="Linked file">
          <LinkPanel link={link} onLink={(kind) => void linkFile(kind)} onImportCopy={() => void importCopy()} />
          <BlockPanel
            aliases={library.aliases}
            comparison={comparison}
            pending={pending}
            writeBlocker={writeBlocker}
            manual={link.status === 'manual'}
            onWrite={() => void planBlockWrite()}
            onCopy={() => void copyBlock()}
            onDownload={downloadUpdated}
          />
        </aside>

        <div className="workspace">
          <div className="tabs" role="tablist" aria-label="Views">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                className="tab"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'aliases' && <span className="tab-count">{library.aliases.length}</span>}
              </button>
            ))}
          </div>

          <div className="tabpanel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'aliases' && (
              <>
                <AliasTable
                  aliases={library.aliases}
                  status={library.status}
                  error={library.error}
                  syncStates={comparison?.byName ?? null}
                  query={query}
                  searchRef={searchRef}
                  onQuery={setQuery}
                  onNew={() => setEditing('new')}
                  onStarter={addStarter}
                  onEdit={setEditing}
                  onToggle={toggleAlias}
                  onDelete={deleteAlias}
                  onRetry={() => void library.reload()}
                />
                {scan && <FileScanPanel candidates={candidates} scan={scan} onPull={() => setImporting(true)} />}
              </>
            )}

            {tab === 'raw' &&
              (link.text !== null ? (
                <Suspense fallback={<p className="empty">Loading editor…</p>}>
                  <RawEditor
                    text={link.text}
                    fileName={link.fileName ?? '.bashrc'}
                    writable={writable}
                    onSave={(text, openedWith) => void planRawSave(text, openedWith)}
                    onDownload={(text) => downloadText('bashrc', text)}
                  />
                </Suspense>
              ) : (
                <section className="panel">
                  <p className="empty">
                    {link.status === 'needs-permission'
                      ? 'Reconnect the file (left) to see it here.'
                      : 'Link your .bashrc, or import a copy, to see and edit the whole file here.'}
                  </p>
                </section>
              ))}

            {tab === 'backups' && (
              <BackupsPanel
                version={backupsVersion}
                canCompare={link.text !== null}
                canRestore={writable}
                onCompare={compareSnapshot}
                onRestore={(snapshot) => void planRestore(snapshot)}
              />
            )}
          </div>
        </div>
      </main>

      <StatusBar
        linkStatus={link.status}
        fileName={link.fileName}
        mode={library.mode}
        count={library.aliases.length}
        changes={comparison ? comparison.changes : null}
        pending={pending}
      />

      {editing !== null && (
        <AliasEditor initial={editingAlias} takenNames={takenNames} onSave={saveAlias} onClose={() => setEditing(null)} />
      )}
      {plan && <DiffDialog plan={plan} onConfirm={plan.readOnly ? undefined : confirmPlan} onClose={() => setPlan(null)} />}
      {importing && scan && (
        <ImportDialog candidates={candidates} canMove={writable} onConfirm={confirmImport} onClose={() => setImporting(false)} />
      )}
      {accountOpen && (
        <AccountDialog
          auth={auth}
          localOnly={guest.available?.upload.length ?? 0}
          onUploadLocal={uploadLocal}
          onSignOut={signOut}
          onClose={() => setAccountOpen(false)}
        />
      )}
      {guest.offer && !dialogOpen && <UploadDialog plan={guest.offer} onUpload={uploadLocal} onDismiss={guest.dismiss} />}
    </div>
  )
}
