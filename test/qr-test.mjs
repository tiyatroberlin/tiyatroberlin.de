import { chromium, devices } from 'playwright';
import fs from 'fs';
fs.mkdirSync('test/sonuc', { recursive: true });
const log = [];
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const pg = await ctx.newPage();
// 1) /yorum?oyun=kozalar (eğik çizgisiz, QR'daki gibi)
const r = await pg.goto('https://tiyatroberlin.de/yorum?oyun=kozalar', { waitUntil: 'networkidle' });
log.push('yorum status ' + r.status() + ' final ' + pg.url());
log.push('secili oyun: ' + await pg.$eval('#y-oyun', e => e.value));
await pg.screenshot({ path: 'test/sonuc/1-yorum.png', fullPage: true });
await pg.fill('textarea[name=yorum]', 'Deneme yorumu, sistem testi (Claude). Lütfen dikkate almayın.');
await pg.fill('input[name=ad]', 'Test');
await pg.check('input[name=onay]');
const resP = pg.waitForResponse(x => x.url().includes('api.web3forms.com'), { timeout: 30000 });
await pg.click('button[type=submit]');
const res = await resP;
log.push('web3forms ' + res.status() + ' ' + (await res.text()).slice(0, 300));
await pg.waitForTimeout(1500);
log.push('tesekkur gorunur: ' + await pg.isVisible('#yorum-ok'));
await pg.screenshot({ path: 'test/sonuc/2-tesekkur.png' });
// 2) /kulis
const p2 = await ctx.newPage();
await p2.goto('https://tiyatroberlin.de/kulis', { waitUntil: 'domcontentloaded' }).catch(e => log.push('kulis goto err ' + e.message));
await p2.waitForTimeout(4000);
log.push('kulis final ' + p2.url());
await p2.screenshot({ path: 'test/sonuc/3-kulis.png' });
// 3) /kulis JS kapalıyken yedek sayfa
const c3 = await b.newContext({ ...devices['iPhone 13'], javaScriptEnabled: false });
const p3 = await c3.newPage();
await p3.route('**/whatsapp.com/**', x => x.abort());
await p3.goto('https://tiyatroberlin.de/kulis/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
await p3.waitForTimeout(500);
await p3.screenshot({ path: 'test/sonuc/4-kulis-yedek.png' }).catch(()=>{});
fs.writeFileSync('test/sonuc/rapor.txt', log.join('\n') + '\n');
console.log(log.join('\n'));
await b.close();
