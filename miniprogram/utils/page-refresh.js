const AUTO_REFRESH_TTL_MS = 3000
const dirtyPages = {}

function shouldRefreshOnShow({ lastLoadedAt = 0, now = Date.now(), dirty = false }) {
  if (dirty) return true
  if (!lastLoadedAt) return true
  return now - lastLoadedAt >= AUTO_REFRESH_TTL_MS
}

function markPageDirty(pageKey) {
  if (!pageKey) return
  dirtyPages[pageKey] = true
}

function clearPageDirty(pageKey) {
  if (!pageKey) return
  delete dirtyPages[pageKey]
}

function isPageDirty(pageKey) {
  return !!dirtyPages[pageKey]
}

module.exports = {
  AUTO_REFRESH_TTL_MS,
  shouldRefreshOnShow,
  markPageDirty,
  clearPageDirty,
  isPageDirty,
}
