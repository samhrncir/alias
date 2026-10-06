import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { ToastProvider } from './components/Toasts'
import { LOCAL_KEY } from './lib/aliasRepo'

// jsdom has no File System Access API and tests run without Supabase, so this
// is the signed-out, manual-mode app.
function renderApp() {
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  )
}

function seed(...aliases: { name: string; command: string }[]) {
  localStorage.setItem(
    LOCAL_KEY,
    JSON.stringify(aliases.map((a, i) => ({ id: String(i + 1), description: '', enabled: true, ...a }))),
  )
}

describe('App, signed out', () => {
  it('adds an alias to the library, the block preview and browser storage', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getAllByRole('button', { name: /new alias/i })[0]!)
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^name/i), 'gs')
    await user.type(within(dialog).getByLabelText(/^command/i), 'git status -sb')
    await user.click(within(dialog).getByRole('button', { name: /save alias/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit gs/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/alias block preview/i)).toHaveTextContent("alias gs='git status -sb'")
    expect(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]')).toMatchObject([{ name: 'gs', command: 'git status -sb' }])
  })

  it('refuses a name bash would choke on, and a duplicate one', async () => {
    seed({ name: 'll', command: 'ls -la' })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /new alias/i }))
    const dialog = screen.getByRole('dialog')
    const name = within(dialog).getByLabelText(/^name/i)
    await user.type(name, 'my$alias')
    expect(within(dialog).getByText(/letters, digits/i)).toBeInTheDocument()

    await user.clear(name)
    await user.type(name, 'll')
    await user.type(within(dialog).getByLabelText(/^command/i), 'ls')
    await user.click(within(dialog).getByRole('button', { name: /save alias/i }))
    expect(within(dialog).getByText(/already have an alias/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('can undo a delete', async () => {
    seed({ name: 'll', command: 'ls -la' })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /delete ll/i }))
    expect(screen.queryByRole('button', { name: /edit ll/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /undo/i }))
    expect(screen.getByRole('button', { name: /edit ll/i })).toBeInTheDocument()
  })

  it('disables an alias, which comments it out in the block', async () => {
    seed({ name: 'll', command: 'ls -la' })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('switch', { name: /disable ll/i }))
    expect(screen.getByLabelText(/alias block preview/i)).toHaveTextContent("# alias ll='ls -la'")
  })
})
