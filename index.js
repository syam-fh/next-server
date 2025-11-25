#!/usr/bin/env node

import { spawn } from 'child_process'
import inquirer from 'inquirer'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import net from 'net'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const DEFAULT_PORT = 3000

const log = {
  info: (msg) => console.log(chalk.cyan(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  error: (msg) => console.log(chalk.red(msg)),
  title: (msg) => console.log(chalk.bold.magenta(msg)),
}

// ─── Utilities ─────────────────────────────────────────────

function isNextJsProject() {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json')
    const content = fs.readFileSync(pkgPath, 'utf8')
    const projectPkg = JSON.parse(content)
    return (
      (projectPkg.dependencies && projectPkg.dependencies.next) ||
      (projectPkg.devDependencies && projectPkg.devDependencies.next)
    )
  } catch {
    return false
  }
}

function waitForPort(port, host = 'localhost', timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = 200

    const check = () => {
      const socket = new net.Socket()
      
      socket.setTimeout(200)
      
      socket.on('connect', () => {
        socket.destroy()
        resolve()
      })

      socket.on('timeout', () => {
        socket.destroy()
        tryAgain()
      })

      socket.on('error', () => {
        socket.destroy()
        tryAgain()
      })

      socket.connect(port, host)
    }

    const tryAgain = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('Timeout waiting for server to start'))
        return
      }
      setTimeout(check, interval)
    }

    check()
  })
}

function openBrowser(url) {
  let cmd, args
  if (process.platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '""', url]
  } else if (process.platform === 'darwin') {
    cmd = 'open'
    args = [url]
  } else {
    cmd = 'xdg-open'
    args = [url]
  }

  const child = spawn(cmd, args, { stdio: 'ignore' })
  child.on('error', (err) => {
    // Silently ignore (e.g., headless server)
    console.debug('Browser open failed:', err.message)
  })
}

// ─── Commands ──────────────────────────────────────────────

function showHelp() {
  console.log(`
${chalk.bold('next-run')} – CLI tool to manage Next.js development and production workflows.

${chalk.bold('Interactive mode (default):')}
  next-run                → Display interactive menu

${chalk.bold('Non-interactive mode:')}
  next-run --dev [--host <addr>] [--port <num>]
  next-run --build
  next-run --start

${chalk.bold('Host options:')}
  --host 127.0.0.1    → Local only (secure)
  --host 0.0.0.0      → Network accessible (use cautiously)

${chalk.bold('Examples:')}
  next-run --dev --host 127.0.0.1 --port 4000
  next-run --dev --host 0.0.0.0

${chalk.bold('Other:')}
  next-run --help    → Show help
  next-run --version → Show version

${chalk.dim('Note: Auto-opens browser for dev server. Uses local Next.js via npx.')}
`)
  process.exit(0)
}

function showVersion() {
  console.log(pkg.version)
  process.exit(0)
}

function getPortFromEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    const content = fs.readFileSync(envPath, 'utf8')
    const match = content.match(/PORT\s*=\s*(\d+)/)
    return match ? parseInt(match[1], 10) : null
  } catch {
    return null
  }
}

function runBuildOrStartCommand(cmd) {
  const child = spawn(cmd, { stdio: 'inherit', shell: true })
  child.on('error', () => {
    log.error(`❌ Command failed: ${cmd}`)
    process.exit(1)
  })
  child.on('exit', (code) => {
    if (code !== 0) process.exit(code || 1)
  })
}

async function selectHost() {
  const { hostChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'hostChoice',
      message: 'Select host binding:',
      choices: [
        { name: '🔒 Secure (localhost only) — 127.0.0.1', value: '127.0.0.1' },
        { name: '🌐 Open (network accessible) — 0.0.0.0', value: '0.0.0.0' },
        { name: '✏️ Custom host', value: 'custom' },
      ],
    },
  ])

  if (hostChoice === 'custom') {
    const { customHost } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customHost',
        message: 'Enter custom host address:',
        validate: (input) => !!input.trim() || 'Host cannot be empty.',
      },
    ])
    return customHost.trim()
  }

  return hostChoice
}

async function devMode(port = null, host = null) {
  let finalPort = port
  let finalHost = host

  if (finalPort === null) {
    const envPort = getPortFromEnv()
    const suggestedPort = envPort || DEFAULT_PORT
    const { userPort } = await inquirer.prompt([
      {
        type: 'input',
        name: 'userPort',
        message: 'Enter port for the development server:',
        default: suggestedPort.toString(),
        validate: (input) => {
          const num = parseInt(input, 10)
          return !isNaN(num) && num > 0 && num < 65536 ? true : 'Port must be between 1 and 65535.'
        },
      },
    ])
    finalPort = parseInt(userPort, 10)
  }

  if (finalHost === null) {
    finalHost = await selectHost()
  }

  const displayHost = finalHost === '0.0.0.0' ? 'localhost' : finalHost
  const url = `http://${displayHost}:${finalPort}`

  log.info(`🚀 Starting Next.js dev server on ${finalHost}:${finalPort}...`)
  log.info(`✅ Dev server is running. Press ${chalk.bold('Ctrl+C')} to stop.`)

  const devProcess = spawn(`npx next dev --port ${finalPort} --hostname ${finalHost}`, {
    stdio: 'inherit',
    shell: true,
  })

  devProcess.on('error', (err) => {
    log.error(`❌ Failed to start dev server: ${err.message}`)
    process.exit(1)
  })

  // Auto-open browser when port is ready
  waitForPort(finalPort, finalHost === '0.0.0.0' ? 'localhost' : finalHost)
    .then(() => {
      log.info(`🌐 Opening ${url} in your browser...`)
      openBrowser(url)
    })
    .catch((err) => {
      log.error(`⚠️ Could not auto-open browser: ${err.message}`)
    })

  // Graceful shutdown
  const shutdown = () => {
    log.info('\n🛑 Shutting down dev server...')
    devProcess.kill()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  devProcess.on('exit', (code) => {
    if (code !== 0) {
      log.error(`⚠️ Dev server exited with code ${code}`)
    }
    process.exit(code || 0)
  })
}

function buildMode() {
  log.info('📦 Building Next.js application for production...')
  runBuildOrStartCommand('npm run build')
  log.success('✅ Build completed successfully.')
}

function startMode() {
  log.info('▶️ Starting production server...')
  runBuildOrStartCommand('npm start')
}

// ─── Interactive Menu ──────────────────────────────────────

async function showMenu() {
  if (!isNextJsProject()) {
    log.error(
      '❌ This does not appear to be a Next.js project.\n   Make sure "next" is in your package.json.'
    )
    process.exit(1)
  }

  log.title('\n✨ Next.js Development Helper')
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select an option:',
      choices: [
        { name: 'Start development server', value: 'dev' },
        { name: 'Build for production', value: 'build' },
        { name: 'Start production server', value: 'start' },
        { name: 'Show help', value: 'help' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ])

  switch (action) {
    case 'dev':
      await devMode()
      break
    case 'build':
      buildMode()
      process.exit(0)
      break
    case 'start':
      startMode()
      process.exit(0)
      break
    case 'help':
      showHelp()
      break
    case 'exit':
      log.info('Goodbye! Happy coding! 💻✨')
      process.exit(0)
  }
}

// ─── MAIN EXECUTION (Wrapped in async IIFE) ────────────────

const args = process.argv.slice(2)

;(async () => {
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
  }
  if (args.includes('--version') || args.includes('-v')) {
    showVersion()
  }

  if (args.length === 0) {
    console.clear()
    await showMenu()
    return // ✅ Now safe inside async IIFE
  }

  const hasDev = args.includes('--dev')
  const hasBuild = args.includes('--build')
  const hasStart = args.includes('--start')

  const portIndex = args.indexOf('--port')
  const portValue = portIndex !== -1 ? args[portIndex + 1] : null

  const hostIndex = args.indexOf('--host')
  const hostValue = hostIndex !== -1 ? args[hostIndex + 1] : null

  // Validate port
  let parsedPort = null
  if (portValue !== null) {
    if (!/^\d+$/.test(portValue)) {
      log.error('❌ --port must be followed by a number.')
      process.exit(1)
    }
    parsedPort = parseInt(portValue, 10)
    if (parsedPort <= 0 || parsedPort >= 65536) {
      log.error('❌ Port must be between 1 and 65535.')
      process.exit(1)
    }
  }

  // Validate host
  let parsedHost = null
  if (hostValue !== null) {
    const trimmed = hostValue.trim()
    if (!trimmed) {
      log.error('❌ --host must be followed by a host address.')
      process.exit(1)
    }
    parsedHost = trimmed
  }

  if ((portValue !== null || hostValue !== null) && !hasDev) {
    log.error('❌ --port and --host can only be used with --dev.')
    process.exit(1)
  }

  const modes = [hasDev, hasBuild, hasStart].filter(Boolean)
  if (modes.length === 0) {
    log.error('❌ Please specify one of: --dev, --build, or --start.')
    process.exit(1)
  }
  if (modes.length > 1) {
    log.error('❌ Only one mode may be specified at a time.')
    process.exit(1)
  }

  if (!isNextJsProject()) {
    log.error('❌ This does not appear to be a Next.js project.')
    process.exit(1)
  }

  if (hasDev) {
    await devMode(parsedPort, parsedHost)
  } else if (hasBuild) {
    buildMode()
  } else if (hasStart) {
    startMode()
  }
})().catch((err) => {
  log.error(`💥 Unexpected error: ${err.message}`)
  process.exit(1)
})
