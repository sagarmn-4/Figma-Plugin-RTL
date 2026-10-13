import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const ui = await readFile(new URL('./ui.html', import.meta.url), 'utf8')

await build({
  entryPoints: [fileURLToPath(new URL('./code.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('./code.js', import.meta.url)),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2017',
  define: { __html__: JSON.stringify(ui) },
  charset: 'utf8',
  legalComments: 'none'
})

console.log('Built code.js from code.ts with ui.html embedded.')
