import type * as vite from 'vite'
import { createLogger } from 'vite'
import { logger } from '@nuxt/kit'
import { colorize } from 'consola/utils'
import { hasTTY, isCI } from 'std-env'
import type { NuxtOptions } from '@nuxt/schema'
import { relative } from 'pathe'
import { useResolveFromPublicAssets } from '../plugins/public-dirs'

let duplicateCount = 0
let lastType: vite.LogType | null = null
let lastMsg: string | null = null

export const logLevelMap: Record<NuxtOptions['logLevel'], vite.UserConfig['logLevel']> = {
  silent: 'silent',
  info: 'info',
  verbose: 'info',
}

const logLevelMapReverse: Record<NonNullable<vite.UserConfig['logLevel']>, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
}

const RUNTIME_RESOLVE_REF_RE = /^([^ ]+) referenced in/m
export function createViteLogger (config: vite.InlineConfig, ctx: { hideOutput?: boolean } = {}): vite.Logger {
  const loggedErrors = new WeakSet<any>()
  const canClearScreen = hasTTY && !isCI && config.clearScreen
  const _logger = createLogger()
  const relativeOutDir = relative(config.root!, config.build!.outDir || '')
  const clear = () => {
    _logger.clearScreen(
      // @ts-expect-error silent is a log level but not a valid option for clearScreens
      'silent',
    )
  }
  const clearScreen = canClearScreen ? clear : () => {}

  const { resolveFromPublicAssets } = useResolveFromPublicAssets()

  function output (type: vite.LogType, msg: string, options: vite.LogErrorOptions = {}) {
    if (typeof msg === 'string' && !process.env.DEBUG) {
      // TODO: resolve upstream in Vite
      // Hide sourcemap warnings related to node_modules
      if (msg.startsWith('Sourcemap') && msg.includes('node_modules')) { return }
      // Hide warnings about externals produced by https://github.com/vitejs/vite/blob/v5.2.11/packages/vite/src/node/plugins/css.ts#L350-L355
      if (msg.includes('didn\'t resolve at build time, it will remain unchanged to be resolved at runtime')) {
        const id = msg.trim().match(RUNTIME_RESOLVE_REF_RE)?.[1]
        if (id && resolveFromPublicAssets(id)) { return }
      }
      if (type === 'info' && ctx.hideOutput && msg.includes(relativeOutDir)) { return }
    }

    const sameAsLast = lastType === type && lastMsg === msg
    if (sameAsLast) {
      duplicateCount += 1
      clearScreen()
    } else {
      duplicateCount = 0
      lastType = type
      lastMsg = msg

      if (options.clear) {
        clearScreen()
      }
    }

    if (options.error) {
      loggedErrors.add(options.error)
    }

    const prevLevel = logger.level
    logger.level = logLevelMapReverse[config.logLevel || 'info']
    logger[type](msg + (sameAsLast ? colorize('dim', ` (x${duplicateCount + 1})`) : ''))
    logger.level = prevLevel
  }

  const warnedMessages = new Set<string>()

  const viteLogger: vite.Logger = {
    hasWarned: false,
    info (msg, opts) {
      output('info', msg, opts)
    },
    warn (msg, opts) {
      viteLogger.hasWarned = true
      output('warn', msg, opts)
    },
    warnOnce (msg, opts) {
      if (warnedMessages.has(msg)) { return }
      viteLogger.hasWarned = true
      output('warn', msg, opts)
      warnedMessages.add(msg)
    },
    error (msg, opts) {
      viteLogger.hasWarned = true
      output('error', msg, opts)
    },
    clearScreen () {
      clear()
    },
    hasErrorLogged (error) {
      return loggedErrors.has(error)
    },
  }

  return viteLogger
}
