const ci = require('miniprogram-ci')
const path = require('path')

const ENV_ID = 'cloudbase-7g480302495d5794'
const FUNCTIONS_DIR = path.resolve(__dirname, '../cloudfunctions')

const project = new ci.Project({
  appid: 'your-app-id',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, '..'),
  privateKeyPath: path.resolve(__dirname, '../private.your-app-id.key'),
  ignores: ['node_modules/**/*'],
})

// Pass function names as args, or deploy all if none given
// Usage: node ci/deploy-cloud.js userLogin userSetProfile
const targets = process.argv.slice(2)

const ALL_FUNCTIONS = [
  'operationCreate',
  'operationsList',
  'inventoryRebuild',
  'configGet',
  'configUpdate',
  'userLogin',
  'userSetProfile',
]

const toDeploy = targets.length > 0 ? targets : ALL_FUNCTIONS

async function deployFunction(name) {
  console.log(`Deploying ${name}...`)
  await ci.cloud.uploadFunction({
    project,
    env: ENV_ID,
    name,
    path: path.join(FUNCTIONS_DIR, name),
    force: true,
    remotePath: '',
  })
  console.log(`  ✓ ${name}`)
}

async function main() {
  for (const name of toDeploy) {
    await deployFunction(name)
  }
  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
