let runtimeConfig

try {
  runtimeConfig = require('./runtime-config')
} catch (_) {
  runtimeConfig = require('./runtime-config.template')
}

const { functionsBaseUrl } = runtimeConfig

const SESSION_STORAGE_KEY = 'wm_session_token'
const inflightRequests = new Map()

function getSessionToken() {
  try {
    return wx.getStorageSync(SESSION_STORAGE_KEY) || ''
  } catch (_) {
    return ''
  }
}

function setSessionToken(token) {
  wx.setStorageSync(SESSION_STORAGE_KEY, token || '')
}

function clearSessionToken() {
  try {
    wx.removeStorageSync(SESSION_STORAGE_KEY)
  } catch (_) {
    wx.setStorageSync(SESSION_STORAGE_KEY, '')
  }
}

function buildRequestKey(name, data, skipAuth, token) {
  return JSON.stringify({
    name,
    data: data || {},
    auth: skipAuth ? 'skip' : `token:${token || ''}`,
  })
}

function callCloud(name, data = {}, options = {}) {
  const { skipAuth = false } = options
  const token = getSessionToken()
  const headers = { 'content-type': 'application/json' }

  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`
  }

  const requestKey = buildRequestKey(name, data, skipAuth, token)
  const cached = inflightRequests.get(requestKey)
  if (cached) return cached

  const requestPromise = new Promise((resolve, reject) => {
    wx.request({
      url: `${functionsBaseUrl}/${name}`,
      method: 'POST',
      data,
      header: headers,
      success: res => {
        const result = (res && res.data) || {}
        if (res.statusCode >= 400 || result.success === false) {
          if (res.statusCode === 401) clearSessionToken()
          const err = new Error(result.error || '请求失败')
          err.result = result
          err.statusCode = res.statusCode
          reject(err)
          return
        }
        resolve(result)
      },
      fail: err => reject(new Error((err && err.errMsg) || '网络请求失败')),
    })
  })

  inflightRequests.set(requestKey, requestPromise)
  requestPromise.finally(() => {
    if (inflightRequests.get(requestKey) === requestPromise) {
      inflightRequests.delete(requestKey)
    }
  })

  return requestPromise
}

module.exports = { callCloud, getSessionToken, setSessionToken, clearSessionToken }
