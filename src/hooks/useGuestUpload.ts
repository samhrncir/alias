import { useMemo, useState } from 'react'
import { readLocal } from '../lib/aliasRepo'
import { planCloudUpload, type UploadPlan } from '../utils/merge'
import type { Library } from './useLibrary'

const offeredKey = (userId: string) => `alias.upload-offered.${userId}`

function wasOffered(userId: string): boolean {
  try {
    return localStorage.getItem(offeredKey(userId)) !== null
  } catch {
    return false
  }
}

/**
 * Aliases that exist only in this browser's signed-out library. After sign-in
 * they're offered for upload once per account; `available` stays around so
 * the account panel can still upload them later.
 */
export function useGuestUpload(userId: string | null, library: Library) {
  const [settledFor, setSettledFor] = useState<string | null>(null)

  const available = useMemo<UploadPlan | null>(() => {
    if (!userId || library.mode !== 'cloud' || library.status !== 'ready') return null
    const plan = planCloudUpload(readLocal(), library.aliases, () => crypto.randomUUID())
    return plan.upload.length > 0 ? plan : null
  }, [userId, library.mode, library.status, library.aliases])

  const offer = available && userId && settledFor !== userId && !wasOffered(userId) ? available : null

  function settle() {
    if (!userId) return
    try {
      localStorage.setItem(offeredKey(userId), '1')
    } catch {
      // Worst case the offer shows again next time.
    }
    setSettledFor(userId)
  }

  return {
    offer,
    available,
    /** Uploads the local-only aliases; resolves with how many were sent. */
    async upload(): Promise<number> {
      if (!available) return 0
      await library.commit({ upserted: available.upload, removedIds: [] })
      settle()
      return available.upload.length
    },
    dismiss: settle,
  }
}
