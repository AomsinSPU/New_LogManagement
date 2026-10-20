import { useEffect, useState } from 'react'
import { api, errorText } from './client.js'

// Keep results associated with their request so old data cannot flash on navigation.
export function useResource(path, revision = 0) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    api(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ path, revision, data, error: '', updated: new Date().toISOString() })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ path, revision, data: null, error: errorText(error) })
    })
    return () => controller.abort()
  }, [path, revision])
  const current = result?.path === path && result?.revision === revision
  return current ? { ...result, loading: false } : { data: null, error: '', loading: true }
}