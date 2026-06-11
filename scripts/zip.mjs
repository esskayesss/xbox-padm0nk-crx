import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import archiver from 'archiver';

const root = resolve(import.meta.dirname, '..');
const out = createWriteStream(resolve(root, 'padm0nk.zip'));
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('error', (err) => {
	throw err;
});
out.on('close', () => {
	console.log(`padm0nk.zip created (${archive.pointer()} bytes)`);
});

archive.pipe(out);
archive.directory(resolve(root, 'dist'), false);
await archive.finalize();
