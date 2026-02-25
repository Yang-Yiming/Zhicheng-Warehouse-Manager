const ci = require('miniprogram-ci')
const path = require('path')

const project = new ci.Project({
  appid: 'your-app-id',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, '..'),
  privateKeyPath: path.resolve(__dirname, '../private.your-app-id.key'),
  ignores: ['node_modules/**/*'],
})

async function preview() {
  const result = await ci.preview({
    project,
    version: '0.1.0',
    desc: 'CI preview',
    setting: { es6: true },
    qrcodeFormat: 'terminal',
    qrcodeOutputDest: path.resolve(__dirname, '../preview-qrcode.jpg'),
    onProgressUpdate: console.log,
  })
  console.log('Preview result:', result)
}

preview().catch(err => {
  console.error(err)
  process.exit(1)
})
