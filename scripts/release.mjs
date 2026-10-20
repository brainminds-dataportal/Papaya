// Rebuilds all the release variants in release/current/ (with a single build number increment).
//
// usage: npm run release

import { execFileSync } from 'node:child_process';
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = path.join(projectDir, 'scripts', 'build.mjs');

const VARIANTS = {
    'standard': [],
    'nojquery': ['--nojquery'],
    'nodicom': ['--nodicom'],
    'minimal': ['--nojquery', '--nodicom'],
    'standard-with-atlas': ['--atlas'],
    'standard-with-atlas-local': ['--atlas', '--local'],
};

let first = true;
for (const [variant, args] of Object.entries(VARIANTS)) {
    console.log(`\n=== ${variant} ${args.join(' ')}`);
    //only the first build increments the build number
    execFileSync(process.execPath, [buildScript, ...args, ...(first ? [] : ['--noincrement'])], { cwd: projectDir, stdio: 'inherit' });
    first = false;

    const target = path.join(projectDir, 'release', 'current', variant);
    await rm(target, { recursive: true, force: true });
    await cp(path.join(projectDir, 'build'), target, { recursive: true });
}
