const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const envPath = path.join(root, '.env.local')
const configPath = path.join(root, 'project.config.json')
const templatePath = path.join(root, 'project.config.template.json')
const runtimeConfigPath = path.join(root, 'miniprogram', 'utils', 'runtime-config.js')
const runtimeTemplatePath = path.join(root, 'miniprogram', 'utils', 'runtime-config.template.js')

function parseEnv(content) {
  const lines = content.split(/\r?\n/)
  const env = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    const value = line.slice(eqIndex + 1).trim()

    if (!key) continue

    const unquoted = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    env[key] = unquoted
  }

  return env
}

function main() {
  if (!fs.existsSync(configPath)) {
    if (!fs.existsSync(templatePath)) {
      console.error('project.config.json 不存在，且 project.config.template.json 不存在')
      process.exit(1)
    }

    fs.copyFileSync(templatePath, configPath)
    console.log('已从 project.config.template.json 生成本地 project.config.json')
  }

  if (!fs.existsSync(envPath)) {
    console.error('未找到 .env.local，请先复制 .env.example 并填写 APPID')
    process.exit(1)
  }

  const env = parseEnv(fs.readFileSync(envPath, 'utf8'))
  const appid = String(env.APPID || '').trim()
  const functionsBaseUrl = String(env.SUPABASE_FUNCTIONS_BASE_URL || '').trim().replace(/\/+$/, '')

  if (!appid) {
    console.error('.env.local 缺少 APPID')
    process.exit(1)
  }

  if (!functionsBaseUrl) {
    console.error('.env.local 缺少 SUPABASE_FUNCTIONS_BASE_URL')
    process.exit(1)
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const oldAppid = config.appid
  config.appid = appid
  delete config.cloudfunctionRoot

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  if (oldAppid === appid) {
    console.log('project.config.json 已是最新 APPID，无需变更')
  } else {
    console.log('已从 .env.local 同步 APPID 到 project.config.json')
  }

  if (!fs.existsSync(runtimeTemplatePath)) {
    console.error('miniprogram/utils/runtime-config.template.js 不存在')
    process.exit(1)
  }

  const runtimeTemplate = fs.readFileSync(runtimeTemplatePath, 'utf8')
  const runtimeContent = runtimeTemplate.replace(/__SUPABASE_FUNCTIONS_BASE_URL__/g, functionsBaseUrl)
  fs.writeFileSync(runtimeConfigPath, runtimeContent, 'utf8')
  console.log('已从 .env.local 同步 Supabase 函数地址到 miniprogram/utils/runtime-config.js')
}

main()
