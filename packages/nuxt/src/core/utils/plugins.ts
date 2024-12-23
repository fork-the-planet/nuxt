import { pathToFileURL } from 'node:url'
import { extname } from 'pathe'
import { parseQuery, parseURL } from 'ufo'

export function isVue (id: string, opts: { type?: Array<'template' | 'script' | 'style'> } = {}) {
  // Bare `.vue` file (in Vite)
  const { search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  if (id.endsWith('.vue') && !search) {
    return true
  }

  if (!search) {
    return false
  }

  const query = parseQuery(search)

  // Component async/lazy wrapper
  if (query.nuxt_component) {
    return false
  }

  // Macro
  if (query.macro && (search === '?macro=true' || !opts.type || opts.type.includes('script'))) {
    return true
  }

  // Non-Vue or Styles
  const type = 'setup' in query ? 'script' : query.type as 'script' | 'template' | 'style'
  if (!('vue' in query) || (opts.type && !opts.type.includes(type))) {
    return false
  }

  // Query `?vue&type=template` (in Webpack or external template)
  return true
}

const JS_RE = /\.(?:[cm]?j|t)sx?$/

export function isJS (id: string) {
  // JavaScript files
  const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  return JS_RE.test(pathname)
}

export function getLoader (id: string): 'vue' | 'ts' | 'tsx' | null {
  const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  const ext = extname(pathname)
  if (ext === '.vue') {
    return 'vue'
  }
  if (!JS_RE.test(ext)) {
    return null
  }
  return ext.endsWith('x') ? 'tsx' : 'ts'
}

export function matchWithStringOrRegex (value: string, matcher: string | RegExp) {
  if (typeof matcher === 'string') {
    return value === matcher
  } else if (matcher instanceof RegExp) {
    return matcher.test(value)
  }

  return false
}
