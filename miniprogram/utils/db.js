const { callCloud } = require('./cloud')

// Paginated operations list, newest first
function getOperations(page = 1, pageSize = 20) {
  return callCloud('operationsList', { page, pageSize })
    .then(result => ({ data: result.data || [], total: result.total || 0 }))
}

function getInventory(page = 1, pageSize = 20) {
  return callCloud('inventoryList', { page, pageSize })
    .then(result => ({ data: result.data || [], total: result.total || 0 }))
}

function getConfig() {
  return callCloud('configGet')
    .then(result => ({ data: result.data || {} }))
}

module.exports = { getOperations, getInventory, getConfig }
