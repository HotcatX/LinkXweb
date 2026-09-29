import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  plugins: [{
    name: 'version-admin-config',
    apply: 'build',
    async writeBundle(options) {
      const directory = resolve(options.dir)
      const config = await readFile(resolve(directory, 'admin-config.js'))
      const name = `admin-config.${createHash('sha256').update(config).digest('hex').slice(0, 16)}.js`
      const index = resolve(directory, 'index.html')
      const html = await readFile(index, 'utf8')
      const reference = 'src="./admin-config.js"'
      if (html.split(reference).length !== 2) throw new Error('Expected exactly one management config script')
      // Hosting caches JavaScript for a year. A changed authority must have a
      // new URL so an existing browser cannot reuse the old deployment config.
      await rename(resolve(directory, 'admin-config.js'), resolve(directory, name))
      await writeFile(index, html.replace(reference, `src="./${name}"`))
    }
  }]
})
