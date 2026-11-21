export type DeliveryResult = 'shared' | 'downloaded' | 'cancelled'

/** Browser capabilities used to hand a backup file to the user; swappable in tests. */
export interface DeliveryPlatform {
  /** True on touch devices (iPhone), where a download link is unreliable in an installed PWA. */
  prefersShare(): boolean
  canShareFiles(files: File[]): boolean
  share(data: ShareData): Promise<void>
  download(file: File): void
}

export const browserPlatform: DeliveryPlatform = {
  prefersShare: () => window.matchMedia?.('(pointer: coarse)').matches ?? false,
  canShareFiles: (files) =>
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files }),
  share: (data) => navigator.share(data),
  download: (file) => {
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    // Revoking synchronously can cancel the download in Safari; give it time to start.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
}

/**
 * Hands an (already encrypted) backup file to the user: the share sheet ("Save to Files")
 * on touch devices that support it, otherwise a download. Dismissing the share sheet is
 * reported as 'cancelled'; any other share failure falls back to a download.
 */
export async function deliverBackupFile(
  file: File,
  platform: DeliveryPlatform = browserPlatform,
): Promise<DeliveryResult> {
  let useShare = false
  try {
    useShare = platform.prefersShare() && platform.canShareFiles([file])
  } catch {
    useShare = false
  }

  if (useShare) {
    try {
      await platform.share({ files: [file] })
      return 'shared'
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return 'cancelled'
    }
  }

  platform.download(file)
  return 'downloaded'
}
