import { chromium } from '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core/index.mjs';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(()=>chromium.launch());
const out = async (svg, file, size, transparent) => {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${fs.readFileSync(svg).toString('base64')}" width=${size} height=${size}>`);
  await p.screenshot({ path: file, omitBackground: transparent });
};
await out('logo.svg','../icon.png',1024,false);
await out('logo.svg','../favicon.png',48,false);
await out('foreground.svg','../android-icon-foreground.png',512,true);
await out('background.svg','../android-icon-background.png',512,false);
await out('monochrome.svg','../android-icon-monochrome.png',432,true);
await out('foreground.svg','../splash-icon.png',1024,true);
await b.close();
