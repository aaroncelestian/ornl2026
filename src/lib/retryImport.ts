/** Retry dynamic imports — Vite/HMR and iCloud can flake on first fetch. */
export async function retryImport<T>(
  loader: () => Promise<T>,
  { retries = 3, delayMs = 200 }: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  let last: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await loader()
    } catch (err) {
      last = err
      if (attempt === retries) break
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
    }
  }
  throw last
}
