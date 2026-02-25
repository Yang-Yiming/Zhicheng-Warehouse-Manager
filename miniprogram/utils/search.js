function filterByQuery(list, query, fields) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list

  return list.filter(item => fields.some(field => {
    const value = typeof field === 'function' ? field(item) : item[field]
    return value !== undefined && value !== null && String(value).toLowerCase().includes(q)
  }))
}

module.exports = { filterByQuery }
