import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_ORGANIZATIONS = [
  '学生会',
  '团委',
  '学生发展中心',
  '社区管理委员会',
  '"橙光"志愿服务队',
  '足球队器材存放',
  '篮球队器材存放',
  '其他体育器材存放',
  '备用储物箱',
]

const ADMIN_ROLES = ['admin', 'superadmin', 'chairman']
const VERIFIED_ROLES = ['normal', 'admin', 'superadmin', 'chairman']
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_RENEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000
const EXPORT_PAGE_SIZE = 1000

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function ok(body: Record<string, unknown>, status = 200) {
  return json({ success: true, ...body }, status)
}

function fail(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ success: false, error: message, ...extra }, status)
}

function env(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

function getAdminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function nowIso() {
  return new Date().toISOString()
}

function getRoute(req: Request) {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean)
  const apiIndex = parts.lastIndexOf('api')
  const route = apiIndex >= 0 ? parts.slice(apiIndex + 1).join('/') : parts[parts.length - 1]
  return `/${route || ''}`
}

async function readBody(req: Request) {
  try {
    return await req.json()
  } catch (_) {
    return {}
  }
}

function normalizeArray(values: unknown) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))]
}

function toPositiveInteger(value: unknown) {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return 0
  return num
}

function formatShanghaiDateTime(date: Date) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

function excelSerialToDate(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null
  const epoch = Date.UTC(1899, 11, 30)
  const millis = Math.round(value * 24 * 60 * 60 * 1000)
  return new Date(epoch + millis)
}

function parseImportDate(value: unknown) {
  if (value === null || value === undefined) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value

  if (typeof value === 'number') {
    return excelSerialToDate(value)
  }

  const text = String(value).trim()
  if (!text) return null

  if (/^\d+(\.\d+)?$/.test(text)) {
    return excelSerialToDate(Number(text))
  }

  const isoCandidate = text.replace(/\//g, '-').replace(' ', 'T')
  const isoParsed = new Date(isoCandidate)
  if (!Number.isNaN(isoParsed.getTime())) return isoParsed

  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (!match) return null

  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  if (Number.isNaN(date.getTime())) return null
  return date
}

function normalizeSubmitTimeImport(value: unknown) {
  const parsed = parseImportDate(value)
  return parsed ? parsed.toISOString() : ''
}

function normalizeDisplayDateTimeImport(value: unknown) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text)) return text

  const parsed = parseImportDate(value)
  return parsed ? formatShanghaiDateTime(parsed) : text
}

function describeUnknownError(error: unknown) {
  if (error instanceof HttpError) return error.message
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return '服务器错误'

  const payload = error as Record<string, unknown>
  const segments = [
    payload.message,
    payload.details,
    payload.hint,
    payload.code ? `code=${payload.code}` : '',
  ]
    .map(part => String(part || '').trim())
    .filter(Boolean)

  return segments[0] || '服务器错误'
}

function normalizeOperationImport(record: unknown) {
  const item = (record && typeof record === 'object') ? record as Record<string, unknown> : {}
  return {
    submitTime: normalizeSubmitTimeImport(item.submitTime),
    itemId: String(item.itemId || '').trim(),
    itemName: String(item.itemName || '').trim(),
    operation: String(item.operation || '').trim(),
    organization: String(item.organization || '').trim(),
    quantity: toPositiveInteger(item.quantity),
    operationTime: normalizeDisplayDateTimeImport(item.operationTime),
    operator: String(item.operator || '').trim(),
    submitter: String(item.submitter || '').trim(),
    operatorOpenid: String(item.operatorOpenid || '').trim(),
  }
}

function normalizeInventoryImport(record: unknown) {
  const item = (record && typeof record === 'object') ? record as Record<string, unknown> : {}
  return {
    itemId: String(item.itemId || '').trim(),
    itemName: String(item.itemName || '').trim(),
    organization: String(item.organization || '').trim(),
    quantity: toPositiveInteger(item.quantity),
    lastOperation: String(item.lastOperation || '').trim(),
    lastOperator: String(item.lastOperator || '').trim(),
    lastOperationTime: normalizeDisplayDateTimeImport(item.lastOperationTime),
    notes: String(item.notes || '').trim(),
  }
}

function validateImportedOperations(records: ReturnType<typeof normalizeOperationImport>[]) {
  const allowedOperations = ['入库', '出库', '物资增添', '部分出库']
  records.forEach((item, index) => {
    if (!item.itemId || !item.itemName || !item.organization || !item.operationTime) {
      throw new HttpError(400, `导入失败：操作记录第 ${index + 1} 行存在空字段`)
    }
    if (!allowedOperations.includes(item.operation)) {
      throw new HttpError(400, `导入失败：操作记录第 ${index + 1} 行操作类型无效`)
    }
    if (!item.quantity) {
      throw new HttpError(400, `导入失败：操作记录第 ${index + 1} 行数量无效`)
    }
    if (item.submitTime && Number.isNaN(new Date(item.submitTime).getTime())) {
      throw new HttpError(400, `导入失败：操作记录第 ${index + 1} 行提交时间无效`)
    }
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(item.operationTime)) {
      throw new HttpError(400, `导入失败：操作记录第 ${index + 1} 行操作时间格式无效`)
    }
  })
}

function validateImportedInventory(records: ReturnType<typeof normalizeInventoryImport>[], mode: string) {
  records.forEach((item, index) => {
    if (!item.itemId || !item.itemName || !item.organization) {
      throw new HttpError(400, `导入失败：库存记录第 ${index + 1} 行存在空字段`)
    }
    if (!item.quantity) {
      throw new HttpError(400, `导入失败：库存记录第 ${index + 1} 行数量无效`)
    }
    if (mode === 'full' && !item.lastOperationTime) {
      throw new HttpError(400, `导入失败：库存记录第 ${index + 1} 行缺少最后操作时间`)
    }
    if (mode === 'full' && !item.lastOperation) {
      throw new HttpError(400, `导入失败：库存记录第 ${index + 1} 行缺少最后操作`)
    }
    if (mode === 'full' && !item.lastOperator) {
      throw new HttpError(400, `导入失败：库存记录第 ${index + 1} 行缺少最后操作人`)
    }
    if (mode === 'full' && item.lastOperationTime && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(item.lastOperationTime)) {
      throw new HttpError(400, `导入失败：库存记录第 ${index + 1} 行最后操作时间格式无效`)
    }
  })
}

function formatUser(user: Record<string, unknown> | null) {
  if (!user) return null
  return {
    openid: String(user.openid || ''),
    displayName: String(user.display_name || ''),
    organizations: normalizeArray(user.organizations),
    role: String(user.role || 'unverified'),
  }
}

function formatOperation(row: Record<string, unknown>) {
  return {
    id: row.id,
    submitTime: row.submit_time,
    itemId: row.item_id,
    itemName: row.item_name,
    operation: row.operation,
    organization: row.organization,
    quantity: row.quantity,
    operationTime: row.operation_time,
    operator: row.operator,
    submitter: row.submitter,
    operatorOpenid: row.operator_openid,
  }
}

function formatInventory(row: Record<string, unknown>) {
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    organization: row.organization,
    quantity: row.quantity,
    lastOperation: row.last_operation,
    lastOperator: row.last_operator,
    lastOperationTime: row.last_operation_time,
    notes: row.notes || '',
  }
}

function formatConfig(row: Record<string, unknown> | null) {
  const data = row || {}
  return {
    organizations: normalizeArray(data.organizations || DEFAULT_ORGANIZATIONS),
    operators: normalizeArray(data.operators),
  }
}

async function selectAllRows(
  supabase: ReturnType<typeof getAdminClient>,
  table: 'operations' | 'inventory',
  orderColumn: 'submit_time' | 'item_id',
  ascending: boolean,
) {
  const rows: Record<string, unknown>[] = []
  let from = 0

  while (true) {
    const to = from + EXPORT_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderColumn, { ascending })
      .range(from, to)

    if (error) throw error

    const batch = Array.isArray(data) ? data : []
    rows.push(...batch)
    if (batch.length < EXPORT_PAGE_SIZE) break
    from += EXPORT_PAGE_SIZE
  }

  return rows
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getBearerToken(req: Request) {
  const value = req.headers.get('Authorization') || ''
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

async function requireUser(req: Request, supabase: ReturnType<typeof getAdminClient>) {
  const token = getBearerToken(req)
  if (!token) throw new HttpError(401, '登录已失效，请重新进入小程序')

  const tokenHash = await sha256(token)
  const { data: session, error: sessionError } = await supabase.rpc('get_session_user', {
    p_token_hash: tokenHash,
  })

  if (sessionError) throw sessionError
  const sessionRow = Array.isArray(session) ? session[0] : session
  if (!sessionRow) throw new HttpError(401, '登录已失效，请重新进入小程序')

  const expiresAt = new Date(String(sessionRow.expires_at)).getTime()
  if (expiresAt <= Date.now()) {
    await supabase.from('mini_sessions').delete().eq('token_hash', tokenHash)
    throw new HttpError(401, '登录已过期，请重新进入小程序')
  }

  const user = {
    openid: sessionRow.openid,
    display_name: sessionRow.display_name,
    organizations: sessionRow.organizations,
    role: sessionRow.role,
    dismissed: sessionRow.dismissed,
    created_at: sessionRow.created_at,
    updated_at: sessionRow.updated_at,
  }
  if (!user) throw new HttpError(401, '用户不存在，请重新登录')

  if ((expiresAt - Date.now()) <= SESSION_RENEW_THRESHOLD_MS) {
    await supabase
      .from('mini_sessions')
      .update({ expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(), updated_at: nowIso() })
      .eq('token_hash', tokenHash)
  }

  return { user }
}

function assertVerified(user: Record<string, unknown>) {
  if (!VERIFIED_ROLES.includes(String(user.role || 'unverified'))) {
    throw new HttpError(403, '权限不足，请联系管理员授权')
  }
}

function assertAdmin(user: Record<string, unknown>) {
  if (!ADMIN_ROLES.includes(String(user.role || 'unverified'))) {
    throw new HttpError(403, '权限不足')
  }
}

async function ensureConfig(supabase: ReturnType<typeof getAdminClient>) {
  const { data, error } = await supabase.rpc('ensure_default_config')
  if (error) throw error
  return data
}

async function fetchWechatOpenId(code: string) {
  const appid = env('WECHAT_APPID')
  const secret = env('WECHAT_APP_SECRET')
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', appid)
  url.searchParams.set('secret', secret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('微信登录服务不可用')

  const payload = await res.json()
  if (!payload?.openid) {
    throw new Error(payload?.errmsg || '微信登录失败')
  }

  return String(payload.openid)
}

async function handleUserLogin(body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const code = String(body.code || '').trim()
  if (!code) throw new HttpError(400, '缺少登录 code')

  const openid = await fetchWechatOpenId(code)
  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('*')
    .eq('openid', openid)
    .maybeSingle()

  if (existingError) throw existingError

  let user = existing
  if (!user) {
    const { count, error: countError } = await supabase
      .from('users')
      .select('openid', { count: 'exact', head: true })
    if (countError) throw countError

    const role = (count || 0) === 0 ? 'chairman' : 'unverified'
    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert({
        openid,
        display_name: '',
        organizations: [],
        role,
        dismissed: false,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .select('*')
      .single()

    if (insertError) throw insertError
    user = inserted
  }

  const sessionToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const tokenHash = await sha256(sessionToken)

  await supabase.from('mini_sessions').delete().eq('openid', openid)

  const { error: sessionError } = await supabase.from('mini_sessions').insert({
    openid,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    created_at: nowIso(),
    updated_at: nowIso(),
  })
  if (sessionError) throw sessionError

  return ok({
    isNew: !user.display_name,
    user: formatUser(user),
    sessionToken,
  })
}

async function handleConfigGet(supabase: ReturnType<typeof getAdminClient>) {
  const row = await ensureConfig(supabase)
  return ok({ data: formatConfig(row) })
}

async function handleUserSetProfile(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  const displayName = String(body.displayName || '').trim()
  if (!displayName) throw new HttpError(400, '昵称不能为空')
  if (displayName.length > 20) throw new HttpError(400, '昵称不能超过20个字符')

  const { data, error } = await supabase
    .from('users')
    .update({ display_name: displayName, updated_at: nowIso() })
    .eq('openid', user.openid)
    .select('*')
    .single()
  if (error) throw error

  return ok({ user: formatUser(data) })
}

async function handleOperationsList(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  await requireUser(req, supabase)

  const page = Math.max(1, Number(body.page) || 1)
  const pageSize = Math.max(1, Math.min(100, Number(body.pageSize) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize

  const { data, error: listError } = await supabase
    .from('operations')
    .select('*')
    .order('submit_time', { ascending: false })
    .range(from, to)

  if (listError) throw listError

  const rows = Array.isArray(data) ? data : []
  const hasMore = rows.length > pageSize

  return ok({
    data: rows.slice(0, pageSize).map(formatOperation),
    hasMore,
    page,
    pageSize,
  })
}

async function handleInventoryList(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  await requireUser(req, supabase)

  const page = Math.max(1, Number(body.page) || 1)
  const pageSize = Math.max(1, Math.min(100, Number(body.pageSize) || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize

  const { data, error: listError } = await supabase
    .from('inventory')
    .select('*')
    .order('item_id', { ascending: true })
    .range(from, to)

  if (listError) throw listError

  const rows = Array.isArray(data) ? data : []
  const hasMore = rows.length > pageSize

  return ok({
    data: rows.slice(0, pageSize).map(formatInventory),
    hasMore,
    page,
    pageSize,
  })
}

async function handleInventoryGet(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  assertVerified(user)

  const itemId = String(body.itemId || '').trim()
  const organization = String(body.organization || '').trim()
  if (!itemId) throw new HttpError(400, '缺少物资编号')

  let query = supabase.from('inventory').select('*').eq('item_id', itemId)
  if (organization) query = query.eq('organization', organization)
  const { data, error } = await query.order('updated_at', { ascending: false }).limit(1)
  if (error) throw error

  if (!data || data.length === 0) {
    return ok({ found: false, data: null })
  }

  return ok({ found: true, data: formatInventory(data[0]) })
}

async function handleOperationCreate(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  assertVerified(user)
  if (!String(user.display_name || '').trim()) throw new HttpError(400, '请先完善个人信息')

  const payload = {
    p_item_id: String(body.itemId || '').trim(),
    p_item_name: String(body.itemName || '').trim(),
    p_operation: String(body.operation || '').trim(),
    p_organization: String(body.organization || '').trim(),
    p_quantity: Number(body.quantity),
    p_operation_time: String(body.operationTime || '').trim(),
    p_operator: String(user.display_name || '').trim(),
    p_operator_openid: String(user.openid || ''),
  }

  const { error } = await supabase.rpc('apply_operation', payload)
  if (error) throw error

  return ok({})
}

async function handleDataExport(req: Request, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  assertVerified(user)

  const [operations, inventory] = await Promise.all([
    selectAllRows(supabase, 'operations', 'submit_time', false),
    selectAllRows(supabase, 'inventory', 'item_id', true),
  ])

  return ok({
    operations: operations.map(formatOperation),
    inventory: inventory.map(formatInventory),
  })
}

async function handleDataImport(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  if (String(user.role || '') !== 'chairman') throw new HttpError(403, '仅大提督可执行导入操作')
  if (!String(user.display_name || '').trim()) throw new HttpError(400, '请先完善个人信息')

  const mode = String(body.mode || '').trim()
  if (!['full', 'old_inventory'].includes(mode)) {
    throw new HttpError(400, `未知的导入模式: ${mode || '(空)'}`)
  }

  const operations = Array.isArray(body.operations) ? body.operations.map(normalizeOperationImport) : []
  const inventory = Array.isArray(body.inventory) ? body.inventory.map(normalizeInventoryImport) : []

  if (mode === 'full' && operations.length === 0 && inventory.length === 0) {
    throw new HttpError(400, '导入数据为空')
  }
  if (mode === 'old_inventory' && inventory.length === 0) {
    throw new HttpError(400, '导入数据为空')
  }

  if (mode === 'full') validateImportedOperations(operations)
  validateImportedInventory(inventory, mode)

  const { data, error } = await supabase.rpc('replace_imported_data', {
    p_mode: mode,
    p_operations: operations,
    p_inventory: inventory,
    p_actor_openid: String(user.openid || ''),
    p_actor_name: String(user.display_name || '').trim(),
  })
  if (error) throw error

  return ok({
    importedOperations: Number(data?.importedOperations || 0),
    importedInventory: Number(data?.importedInventory || 0),
  })
}

async function handleUserSetOrgs(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  assertAdmin(user)

  const targetOpenid = String(body.targetOpenid || user.openid || '').trim()
  const organizations = normalizeArray(body.organizations)
  if (!targetOpenid) throw new HttpError(400, '缺少用户标识')

  const { error } = await supabase
    .from('users')
    .update({ organizations, updated_at: nowIso() })
    .eq('openid', targetOpenid)
  if (error) throw error

  return ok({})
}

async function handleUserList(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  assertVerified(user)

  const roles = normalizeArray(body.roles)
  let query = supabase.from('users').select('*').order('created_at', { ascending: false })
  if (roles.length > 0) query = query.in('role', roles)
  if (roles.includes('unverified')) query = query.eq('dismissed', false)

  const { data, error } = await query
  if (error) throw error

  return ok({
    data: (data || []).map(item => ({
      ...formatUser(item),
      dismissed: Boolean(item.dismissed),
    })),
  })
}

async function handleConfigUpdate(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  assertAdmin(user)

  const current = formatConfig(await ensureConfig(supabase))
  const organizations = Object.prototype.hasOwnProperty.call(body, 'organizations')
    ? normalizeArray(body.organizations)
    : current.organizations
  const operators = Object.prototype.hasOwnProperty.call(body, 'operators')
    ? normalizeArray(body.operators)
    : current.operators

  const { error } = await supabase.from('config').upsert({
    key: 'settings',
    organizations,
    operators,
    updated_at: nowIso(),
  })
  if (error) throw error

  return ok({ data: { organizations, operators } })
}

async function handleUserSetRole(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  assertAdmin(user)

  const targetOpenid = String(body.targetOpenid || '').trim()
  const newRole = String(body.newRole || '').trim()
  if (!targetOpenid || !newRole) throw new HttpError(400, '参数缺失')
  if (targetOpenid === user.openid) throw new HttpError(400, '不能修改自己的角色')

  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('*')
    .eq('openid', targetOpenid)
    .maybeSingle()
  if (targetError) throw targetError
  if (!target) throw new HttpError(404, '用户不存在')

  const callerRole = String(user.role || 'unverified')
  const targetRole = String(target.role || 'unverified')

  if (targetRole === 'superadmin') throw new HttpError(400, '不能修改超管的角色')

  if (newRole === 'dismissed') {
    if (targetRole !== 'unverified') throw new HttpError(400, '只能忽略未认证用户')
    const { error } = await supabase
      .from('users')
      .update({ dismissed: true, updated_at: nowIso() })
      .eq('openid', targetOpenid)
    if (error) throw error
    return ok({})
  }

  if (callerRole === 'admin' || callerRole === 'superadmin') {
    if (!(targetRole === 'unverified' && newRole === 'normal')) {
      throw new HttpError(403, '权限不足，只能审批未认证用户')
    }
  }

  if (callerRole === 'chairman') {
    const allowed = (
      (targetRole === 'unverified' && newRole === 'normal') ||
      (targetRole === 'normal' && newRole === 'admin') ||
      (targetRole === 'admin' && newRole === 'normal')
    )
    if (!allowed) throw new HttpError(400, '不支持该角色变更')
  }

  const { error } = await supabase
    .from('users')
    .update({ role: newRole, dismissed: false, updated_at: nowIso() })
    .eq('openid', targetOpenid)
  if (error) throw error

  return ok({})
}

async function handleChairmanTransfer(req: Request, body: Record<string, unknown>, supabase: ReturnType<typeof getAdminClient>) {
  const { user } = await requireUser(req, supabase)
  if (String(user.role || '') !== 'chairman') throw new HttpError(403, '权限不足')

  const targetOpenid = String(body.targetOpenid || '').trim()
  if (!targetOpenid) throw new HttpError(400, '参数缺失')

  const { data: target, error: targetError } = await supabase
    .from('users')
    .select('*')
    .eq('openid', targetOpenid)
    .maybeSingle()
  if (targetError) throw targetError
  if (!target) throw new HttpError(404, '用户不存在')
  if (String(target.role || '') !== 'admin') throw new HttpError(400, '只能转让给管理员')

  const now = nowIso()
  const { error: promoteError } = await supabase
    .from('users')
    .update({ role: 'chairman', updated_at: now })
    .eq('openid', targetOpenid)
  if (promoteError) throw promoteError

  const { error: demoteError } = await supabase
    .from('users')
    .update({ role: 'admin', updated_at: now })
    .eq('openid', user.openid)
  if (demoteError) throw demoteError

  return ok({})
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 405)
  }

  const route = getRoute(req)
  const body = await readBody(req) as Record<string, unknown>

  try {
    const supabase = getAdminClient()

    switch (route) {
      case '/userLogin':
        return await handleUserLogin(body, supabase)
      case '/configGet':
        return await handleConfigGet(supabase)
      case '/userSetProfile':
        return await handleUserSetProfile(req, body, supabase)
      case '/operationsList':
        return await handleOperationsList(req, body, supabase)
      case '/inventoryList':
        return await handleInventoryList(req, body, supabase)
      case '/inventoryGet':
        return await handleInventoryGet(req, body, supabase)
      case '/operationCreate':
        return await handleOperationCreate(req, body, supabase)
      case '/userSetOrgs':
        return await handleUserSetOrgs(req, body, supabase)
      case '/userList':
        return await handleUserList(req, body, supabase)
      case '/configUpdate':
        return await handleConfigUpdate(req, body, supabase)
      case '/userSetRole':
        return await handleUserSetRole(req, body, supabase)
      case '/chairmanTransfer':
        return await handleChairmanTransfer(req, body, supabase)
      case '/dataExport':
        return await handleDataExport(req, supabase)
      case '/dataImport':
        return await handleDataImport(req, body, supabase)
      case '/inventoryRebuild':
        return fail('该功能将在第二阶段迁移到 Supabase', 501)
      default:
        return fail('接口不存在', 404)
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return fail(error.message, error.status)
    }

    const message = describeUnknownError(error)
    return fail(message, 500)
  }
})
