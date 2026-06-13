import { createWriteStream, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import archiver from 'archiver';

const root = resolve(import.meta.dirname, '..');

// Version from package.json (mirrors manifest.config.ts version).
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const zipName = `padm0nk-${pkg.version}.zip`;

const out = createWriteStream(resolve(root, zipName));
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('error', (err) => {
	throw err;
});
out.on('close', () => {
	console.log(`${zipName} created (${archive.pointer()} bytes)`);
});

archive.pipe(out);
// Zip the BUILD OUTPUT (dist/) contents at the archive root, not source.
archive.directory(resolve(root, 'dist'), false);
await archive.finalize();
