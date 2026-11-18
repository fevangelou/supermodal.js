// Builds dist/ from src/ and publishes the release to docs/dist/<version>/ and docs/dist/latest/ (GitHub Pages).
// Usage: npm run build
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const LIMITS = { js: 14336, css: 5120 }; // gzipped bytes

const banner = (kind) => `/*! SuperModal.js v${version}${kind === 'css' ? ' (styles)' : ''} | MIT License | (c) 2026 JoomlaWorks Ltd. | https://github.com/fevangelou/supermodal.js */`;

let failed = false;
for (const kind of ['js', 'css']) {
  const src = path.join(root, 'src', `supermodal.${kind}`);
  const code = fs.readFileSync(src, 'utf8');
  if (!code.includes(`SuperModal.js v${version}`)) {
    console.error(`src/supermodal.${kind}: the header doesn't say v${version} (package.json)`);
    process.exit(1);
  }
  const out = esbuild.transformSync(code, {
    loader: kind,
    minify: true,
    target: kind === 'js' ? 'es2020' : undefined,
    legalComments: 'none',
    banner: banner(kind),
  }).code;
  const gz = zlib.gzipSync(out, { level: 9 }).length;
  console.log(`supermodal.min.${kind}: ${out.length} bytes, ${gz} gzipped (ceiling ${LIMITS[kind]})`);
  if (gz > LIMITS[kind]) {
    failed = true;
  }
  for (const dir of ['dist', `docs/dist/${version}`, 'docs/dist/latest']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.copyFileSync(src, path.join(root, dir, `supermodal.${kind}`));
    fs.writeFileSync(path.join(root, dir, `supermodal.min.${kind}`), out);
  }
}
if (failed) {
  console.error('OVER BUDGET');
  process.exit(1);
}
console.log(`Published to dist/, docs/dist/${version}/ and docs/dist/latest/`);
