import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CopyChip } from './CopyChip'

describe('CopyChip', () => {
  it('copies its text and confirms it', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve())
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText)
    render(<CopyChip text="%USERPROFILE%" />)

    await user.click(screen.getByRole('button', { name: /%USERPROFILE%/ }))

    expect(writeText).toHaveBeenCalledWith('%USERPROFILE%')
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
  })
})
