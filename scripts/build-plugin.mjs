#!/usr/bin/env node
/**
 * Shared build for every plugin in this repository.
 *
 * Usage: node scripts/build-plugin.mjs [plugin-dir]   (default: cwd)
 *
 * Each plugin package keeps a thin `build`/`prepare` script that calls this
 * file, so the DSH client artifact format lives in exactly one place:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => module.exports })
 *
 * The browser entry is bundled as CJS with the host baseline left external
 * and wrapped in that factory; the node entry is a plain ESM bundle. Types are
 * stripped by esbuild without checking — plugin sources import DSH packages
 * type-only, which is what keeps this repository independent of them.
 */
import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const target = resolve(process.argv[2] ?? '.')
const pkg = JSON.parse(await readFile(resolve(target, 'package.json'), 'utf8'))

/** Host-provided modules: the client baseline plus type-only DSH imports. */
const external = ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*']

const shared = {
  bundle: true,
  target: 'es2022',
  external,
  jsx: 'automatic',
  logLevel: 'info',
}

console.log(`[build-plugin] ${pkg.name} (${target})`)

/** Bundle the browser half and wrap it in the loader factory the host expects. */
async function bundleClient() {
  const result = await build({
    ...shared,
    platform: 'browser',
    entryPoints: [resolve(target, 'src/client/index.ts')],
    format: 'cjs',
    write: false,
  })
  const code = result.outputFiles[0].text
  const indented = code
    .split('\n')
    .map(line => (line === '' ? line : `\t\t${line}`))
    .join('\n')
  const wrapped = [
    'window.__ModuleLoader__.load({',
    `\tid: ${JSON.stringify(pkg.name)},`,
    '\tfactory: (require) => {',
    '\t\tvar module = { exports: {} }',
    '\t\tvar exports = module.exports',
    indented,
    '\t\treturn module.exports',
    '\t},',
    '})',
    '',
  ].join('\n')
  await mkdir(resolve(target, 'lib'), { recursive: true })
  await writeFile(resolve(target, 'lib/client.js'), wrapped)
}

/** Bundle the node half as ESM. */
async function bundleNode() {
  await build({
    ...shared,
    platform: 'node',
    entryPoints: [resolve(target, 'src/index.ts')],
    format: 'esm',
    outfile: resolve(target, 'lib/index.js'),
  })
}

await bundleClient()
await bundleNode()
