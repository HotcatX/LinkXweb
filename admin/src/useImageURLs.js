import { useEffect, useMemo, useRef, useState } from 'react'
import { createImageRefresh, createImageURLCache } from './image-urls.js'
export function useImageURLs(api, ids, onError) {
  const [urls, setUrls] = useState({}); const cache = useMemo(() => createImageURLCache(api), [api])
  const key = JSON.stringify([...new Set(ids.filter(Boolean))].sort())
  const current = useRef(null), failure = useRef(onError); failure.current = onError
  useEffect(() => {
    const task = createImageRefresh(cache, JSON.parse(key), { onResult: setUrls, onError: error => failure.current?.(error.message) })
    current.current = task
    void task.refresh()
    const visible = () => { if (!document.hidden) void task.refresh() }
    const interval = setInterval(visible, 30000)
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible)
    return () => {
      task.dispose(); if (current.current === task) current.current = null
      clearInterval(interval); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible)
    }
  }, [key, cache])
  return { urls, imageError: () => { void current.current?.refresh(true) } }
}
