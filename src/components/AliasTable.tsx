import type { RefObject } from 'react'
import { Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import type { LibraryStatus } from '../hooks/useLibrary'
import type { Alias } from '../types'
import type { SyncState } from '../utils/merge'
import { Switch } from './Switch'

interface Props {
  aliases: Alias[]
  status: LibraryStatus
  error: string | null
  /** Per alias name: how it compares to the linked file's block (null with no file). */
  syncStates: Map<string, SyncState> | null
  query: string
  searchRef: RefObject<HTMLInputElement | null>
  onQuery: (query: string) => void
  onNew: () => void
  onStarter: () => void
  onEdit: (alias: Alias) => void
  onToggle: (alias: Alias) => void
  onDelete: (alias: Alias) => void
  onRetry: () => void
}

export function AliasTable(props: Props) {
  const { aliases, status, error, syncStates, query, searchRef, onQuery, onNew, onStarter, onRetry } = props
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? aliases.filter((a) => [a.name, a.command, a.description].some((field) => field.toLowerCase().includes(needle)))
    : aliases

  return (
    <section className="panel" aria-labelledby="library-title">
      <header className="panel-head">
        <h2 id="library-title">
          <span className="kicker">//</span> Library
        </h2>
        <span className="chip">[{aliases.length === 1 ? '1 alias' : `${aliases.length} aliases`}]</span>
      </header>

      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search aliases</span>
          <input
            ref={searchRef}
            className="input"
            type="search"
            value={query}
            placeholder="Search name, command or note   /"
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        <button type="button" className="btn" onClick={onNew}>
          <Plus size={16} /> New alias
        </button>
      </div>

      {status === 'error' && (
        <div className="callout callout-error row">
          <span>Couldn't load your cloud library: {error}</span>
          <button type="button" className="btn btn-sm" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {aliases.length === 0 ? (
        status === 'loading' ? (
          <p className="empty">Syncing library…</p>
        ) : (
          <EmptyLibrary onNew={onNew} onStarter={onStarter} />
        )
      ) : visible.length === 0 ? (
        <p className="empty">No aliases match “{query}”.</p>
      ) : (
        <ul className="alias-list">
          {visible.map((alias) => (
            <AliasRow
              key={alias.id}
              alias={alias}
              state={syncStates?.get(alias.name) ?? null}
              onEdit={props.onEdit}
              onToggle={props.onToggle}
              onDelete={props.onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface RowProps {
  alias: Alias
  state: SyncState | null
  onEdit: (alias: Alias) => void
  onToggle: (alias: Alias) => void
  onDelete: (alias: Alias) => void
}

function AliasRow({ alias, state, onEdit, onToggle, onDelete }: RowProps) {
  return (
    <li className={`alias-row${alias.enabled ? '' : ' is-off'}`}>
      <button
        type="button"
        className="alias-main"
        aria-label={`Edit ${alias.name}, runs ${alias.command}`}
        onClick={() => onEdit(alias)}
      >
        <span className="alias-name">{alias.name}</span>{' '}
        <span className="alias-arrow" aria-hidden="true">
          →
        </span>{' '}
        <code className="alias-cmd">{alias.command}</code>
        {alias.description && <span className="alias-desc">{alias.description}</span>}
      </button>
      <div className="alias-meta">
        {state === 'new' && <span className="badge badge-new">not in file</span>}
        {state === 'edited' && <span className="badge badge-edited">edited</span>}
        <Switch
          checked={alias.enabled}
          onChange={() => onToggle(alias)}
          label={`${alias.enabled ? 'Disable' : 'Enable'} ${alias.name}`}
        />
        <button type="button" className="icon-btn icon-danger" onClick={() => onDelete(alias)} aria-label={`Delete ${alias.name}`}>
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  )
}

function EmptyLibrary({ onNew, onStarter }: { onNew: () => void; onStarter: () => void }) {
  return (
    <div className="terminal">
      <p>
        <span className="prompt">&gt;</span> library empty
      </p>
      <p>
        <span className="prompt">&gt;</span> press <kbd>N</kbd> to add an alias, or start with a few classics
      </p>
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={onNew}>
          <Plus size={14} /> New alias
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onStarter}>
          <Sparkles size={14} /> Add ll, gs and ..
        </button>
      </div>
    </div>
  )
}
