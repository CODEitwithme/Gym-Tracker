import { spawn } from 'node:child_process'
import process from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const workerDir = path.join(rootDir, 'worker')

console.log('🚀 Starting Forge/Fit development servers...')
console.log('   Worker: http://localhost:8787')
console.log('   Web:    http://localhost:5173')

const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'

const workerProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: workerDir,
  stdio: 'inherit',
  shell: true,
})

const webProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
})

function cleanup() {
  console.log('\n🛑 Shutting down development servers...')
  if (workerProcess && !workerProcess.killed) {
    workerProcess.kill()
  }
  if (webProcess && !webProcess.killed) {
    webProcess.kill()
  }
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('exit', cleanup)

