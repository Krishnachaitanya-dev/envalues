export function formatError(err: unknown): string {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message

  const anyErr = err as { message?: unknown; details?: unknown; hint?: unknown; error?: { message?: unknown } }
  const message =
    typeof anyErr.message === 'string' ? anyErr.message
      : typeof anyErr.error?.message === 'string' ? anyErr.error.message
        : ''
  const details = typeof anyErr.details === 'string' ? anyErr.details : ''
  const hint = typeof anyErr.hint === 'string' ? anyErr.hint : ''

  const combined = [message, details, hint].filter(Boolean).join(' - ')
  return combined || 'Unknown error'
}

