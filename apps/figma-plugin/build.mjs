import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const isWatch = process.argv.includes('--watch');
const isDev = process.env.DEV_MODE === 'true';

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Build the main plugin code
const codeConfig = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  platform: 'neutral',
  target: 'es2020',
  format: 'iife',
};

// Build the UI code
const uiConfig = {
  entryPoints: ['src/ui/ui.ts'],
  bundle: true,
  outfile: 'dist/ui.js',
  platform: 'browser',
  target: 'es2020',
  format: 'iife',
  define: {
    'process.env.DEV_MODE': JSON.stringify(isDev ? 'true' : 'false'),
  },
};

async function buildHtml() {
  const html = fs.readFileSync('src/ui/ui.html', 'utf8');
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');
  const js = fs.readFileSync('dist/ui.js', 'utf8');
  
  const finalHtml = html
    .replace('/* STYLES_PLACEHOLDER */', css)
    .replace('/* SCRIPT_PLACEHOLDER */', js);
  
  fs.writeFileSync('dist/ui.html', finalHtml);
}

async function build() {
  try {
    await esbuild.build(codeConfig);
    await esbuild.build(uiConfig);
    await buildHtml();
    console.log('Build complete!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

if (isWatch) {
  const codeCtx = await esbuild.context(codeConfig);
  const uiCtx = await esbuild.context(uiConfig);
  
  await codeCtx.watch();
  await uiCtx.watch();
  
  // Watch for HTML/CSS changes
  fs.watchFile('src/ui/ui.html', async () => {
    await buildHtml();
    console.log('HTML rebuilt');
  });
  fs.watchFile('src/ui/styles.css', async () => {
    await buildHtml();
    console.log('CSS rebuilt');
  });
  
  console.log('Watching for changes...');
} else {
  await build();
}
