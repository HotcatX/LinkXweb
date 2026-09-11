import { readFile, writeFile, rm } from 'node:fs/promises';
import { render } from '../.static-ssr/render.js';
const file = new URL('../dist-cloudbase/index.html', import.meta.url);
const html = (await readFile(file, 'utf8')).replace('<!--app-html-->', render());
await writeFile(new URL('../dist-cloudbase/index.html', import.meta.url), html);
console.log('Public page prerendered for CloudBase static hosting.');
