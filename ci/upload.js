const ci = require('miniprogram-ci')
const path = require('path')

const project = new ci.Project({
  appid: 'your-app-id',
  type: 'miniProgram',
  projectPath: path.resolve(__dirname, '..'),
  privateKeyPath: path.resolve(__dirname, '../private.your-app-id.key'),
  ignores: ['node_modules/**/*'],
})

async function upload() {
  const result = await ci.upload({
    project,
    version: '0.1.0',
    desc: 'CI upload',
    setting: { es6: true, minified: true },
    onProgressUpdate: console.log,
  })
  console.log('Upload result:', result)
}

upload().catch(err => {
  console.error(err)
  process.exit(1)
})
