// Developer-only regression test: npm install --no-save --package-lock=false playwright
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');

(async () => {
  const repo = path.resolve(__dirname, '..');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'review-preview-'));
  const site = path.join(tmp, 'site');
  await fs.mkdir(site);
  const source = path.join(site, 'draft page.html');
  const manifest = path.join(tmp, 'findings.json');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="stylesheet" href="style.css"></head><body><main>
    <h1>Fictional reading list</h1><section id="project"><h2>Our project</h2>
    <p id="draft">By bringing the team's <em>recommendations</em> into a shared space that connected individual interests with the wider reading process, I made the list part of how we exchanged ideas.</p>
    <p id="inline">A <strong>shared <em>reading</em></strong> list &amp; notes.</p>
    <p id="repeat">Shared work. Shared work.</p><p class="same">Repeated elsewhere.</p><p class="same">Repeated elsewhere.</p>
    <p id="whitespace">More   space\n between <span>words</span>.</p>
    <p id="break">Before<br>after.</p><div id="blocks"><p>First.</p><p>Second.</p></div>
    <p id="korean">함께 <strong>읽는</strong> 목록입니다.</p><p hidden id="hidden">Hidden words.</p>
    <a href="next.html#destination" id="link">Open another page</a><img src="dot.svg" alt="A dot">
    </section><p style="margin-top:1100px" id="bottom">The final thought needs a clearer subject.</p>
    </main></body></html>`;
  await fs.writeFile(source, html);
  await fs.writeFile(path.join(site, 'style.css'), 'body{margin:0;padding:40px;font:18px/1.6 sans-serif}main{max-width:700px;margin:auto}body>main:last-child{background:rgb(250,249,248)}p{margin:24px 0}em{font-style:normal}');
  await fs.writeFile(path.join(site, 'next.html'), '<p id="destination">Another page</p>');
  await fs.writeFile(path.join(site, 'dot.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8"/></svg>');
  const item = (id, selector, quote, kind) => ({id, selector, quote, reason:`Reason ${id}: <b>literal</b>`, ...(kind ? {kind} : {})});
  const data = {language:'en', findings:[
    item(1, '#draft', "By bringing the team's recommendations into a shared space that connected individual interests with the wider reading process, I made the list part of how we exchanged ideas."),
    item(2, '#inline', 'A shared reading list & notes.'),
    item(3, '#project', 'Our project', 'group'),
    item(4, '#repeat', 'Shared work.'),
    item(5, '.same', 'Repeated elsewhere.'),
    item(6, '#draft', 'Removed sentence.'),
    item(7, '#whitespace', 'More space between words.'),
    item(8, '#break', 'Before after.'),
    item(9, '#blocks', 'First. Second.'),
    item(10, '#hidden', 'Hidden words.'),
    item(11, '[', 'Broken selector'),
    item(12, '#bottom', 'The final thought needs a clearer subject.'),
    item(13, '#korean', '함께 읽는 목록입니다.')
  ]};
  await fs.writeFile(manifest, JSON.stringify(data));
  const server = spawn(process.env.PYTHON || 'python3', [path.join(repo,'scripts/preview.py'),source,'--findings',manifest,'--root',site,'--port','0']);
  let browser;
  try {
    let output = '';
    const url = await new Promise((resolve,reject) => {
      server.stdout.on('data', chunk => { output += chunk; const match = output.match(/Review preview: (http[^\s]+)/); if(match) resolve(match[1]); });
      server.once('error', reject);
      server.once('exit', code => reject(new Error(`Preview exited ${code}`)));
    });
    browser = await chromium.launch();
    const page = await browser.newPage({viewport:{width:1100,height:850}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const snapshot = () => page.locator('main').evaluate(el => ({html:document.body.innerHTML, rect:el.getBoundingClientRect().toJSON(), font:getComputedStyle(el).font, color:getComputedStyle(el).color, background:getComputedStyle(el).backgroundColor}));
    await page.goto(url+'?review=off');
    const before = await snapshot();
    await page.goto(url);
    await page.getByRole('button',{name:'Go to finding 1',exact:true}).waitFor();
    const after = await snapshot();
    assert.deepEqual(after,before,'Source DOM and geometry preserved');
    const state = () => page.locator('review-highlight-preview').evaluate(el => ({
      statuses:[...el.shadowRoot.querySelectorAll('li')].map(e=>e.textContent),
      ids:[...new Set([...el.shadowRoot.querySelectorAll('.box')].map(e=>Number(e.dataset.finding)))],
      boxes:[...el.shadowRoot.querySelectorAll('.box')].map(e=>({id:Number(e.dataset.finding),rect:e.getBoundingClientRect().toJSON()}))
    }));
    let current = await state();
    assert.deepEqual(current.ids.sort((a,b)=>a-b),[1,2,3,7,8,9,12,13]);
    for (const id of [4,5,6,10,11]) assert.equal(await page.getByRole('button',{name:`Go to finding ${id}`,exact:true}).isDisabled(),true);
    assert(current.statuses[3].includes('Repeated text'));
    assert(current.statuses[4].includes('exactly one'));
    assert(current.statuses[5].includes('missing or changed'));
    assert.equal(await page.locator('review-highlight-preview li b').count(),0,'Reasons are plain text');
    assert.equal(await page.locator('img').evaluate(el=>el.complete && el.naturalWidth>0),true);
    assert.equal(await page.locator('#link').getAttribute('href'),'next.html#destination');
    await page.getByRole('button',{name:'Go to finding 12',exact:true}).click();
    assert(await page.locator('#bottom').evaluate(el => {const r=el.getBoundingClientRect(); return r.top>=0 && r.bottom<innerHeight;}));
    await page.getByRole('button',{name:'Go to finding 1',exact:true}).click();
    const wideLines = (await state()).boxes.filter(b=>b.id===1).length;
    await page.setViewportSize({width:375,height:760});
    await page.waitForFunction(() => {
      const el=document.querySelector('review-highlight-preview');
      const marks=[...el.shadowRoot.querySelectorAll('.box[data-finding="1"]')];
      return marks.length>5;
    });
    current=await state();
    assert(current.boxes.filter(b=>b.id===1).length>wideLines,'Wrap recalculated');
    assert(await page.locator('review-highlight-preview nav').evaluate(el=>{const r=el.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight;}));
    // Compare annotation geometry against current source Range after resize.
    const aligned = await page.locator('#draft').evaluate(el=>{
      const range=document.createRange(); range.selectNodeContents(el);
      const first=range.getClientRects()[0];
      const box=document.querySelector('review-highlight-preview').shadowRoot.querySelector('.box[data-finding="1"]').getBoundingClientRect();
      return Math.abs(first.left-box.left-3)<1 && Math.abs(first.top-box.top-2)<1;
    });
    assert(aligned,'Outline aligned after resize');
    await page.emulateMedia({media:'print'});
    assert.equal(await page.locator('review-highlight-preview').evaluate(el=>getComputedStyle(el).display),'none');
    await page.emulateMedia({media:'screen'});
    assert.equal(await fs.readFile(source,'utf8'),html,'Preview never writes the source');
    // Save a user revision, refresh, withhold obsolete quote, then deliberately update finding.
    const revised = html.replace("By bringing the team's <em>recommendations</em> into a shared space that connected individual interests with the wider reading process, I made the list part of how we exchanged ideas.", 'I created one list with a title, note, and link for each book.');
    await fs.writeFile(source,revised);
    await page.getByRole('button',{name:'Refresh source',exact:true}).click();
    await page.waitForLoadState('load');
    await page.getByRole('button',{name:'Go to finding 1',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Go to finding 1',exact:true}).isDisabled(),true);
    assert(!(await state()).ids.includes(1));
    data.findings[0].quote='I created one list with a title, note, and link for each book.';
    data.language='ko';
    await fs.writeFile(manifest,JSON.stringify(data));
    await page.getByRole('button',{name:'Refresh source',exact:true}).click();
    await page.getByRole('button',{name:'검토 위치로 이동 1',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'검토 위치로 이동 1',exact:true}).isEnabled(),true);
    // Same quote duplicated inside the scope must never choose the first instance.
    await fs.writeFile(source,revised.replace(data.findings[0].quote,data.findings[0].quote+' '+data.findings[0].quote));
    await page.getByRole('button',{name:'원본에서 갱신',exact:true}).click();
    await page.getByRole('button',{name:'검토 위치로 이동 1',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'검토 위치로 이동 1',exact:true}).isDisabled(),true);
    await fs.writeFile(manifest,'{');
    await page.getByRole('button',{name:'원본에서 갱신',exact:true}).click();
    await page.getByText('Cannot load findings. Fix the file and refresh.').waitFor();
    assert.deepEqual((await state()).ids,[]);
    await page.getByRole('button',{name:'Remove',exact:true}).click();
    await page.waitForURL('**?review=off');
    assert.equal(await page.locator('review-highlight-preview').count(),0);
    await page.reload();
    assert.equal(await page.locator('review-highlight-preview').count(),0);
    await page.locator('#link').click();
    await page.waitForURL('**/next.html#destination');
    assert.equal(await page.locator('#destination').textContent(),'Another page');
    assert.deepEqual(errors,[]);
    console.log('PASS: preservation, assets/links, exact/scoped matching, inline markup, whitespace/BR/blocks, Korean, missing/duplicate/hidden/invalid targets, resize, navigation, print, edit/refresh, invalid manifest, removal.');
  } finally {
    if(browser) await browser.close();
    server.kill('SIGINT');
    if(server.exitCode===null) await once(server,'exit');
    await fs.rm(tmp,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
