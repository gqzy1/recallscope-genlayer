import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {discover,normalizeNotices,rankNotices,officialURL} from '../src/discovery.js';
import {createCase,addNotice,activeRevision,startRevision,requestFor,saveRecord,summary,restoreCase,compareRevision,missingDetails} from '../src/investigation.js';
import {initWorkbench} from '../src/workbench.js';
import {canonical,sha256} from '../src/core.js';
const actual=JSON.parse(fs.readFileSync('tests/fixtures/finalized-record.json'));
const snapshot=JSON.parse(fs.readFileSync('data/cpsc-anker.json'));
const notices=normalizeNotices(snapshot.rows),product=actual.input.product,contract='0x5EbaD2E0dA70e9aCd8f50C6837cb060965257F70';
const make=()=>createCase(product,'testcase0001');
const selected=c=>addNotice(c,{url:actual.input.notice_url,title:'Power bank recall'});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('official discovery requests documented title filter and ranks model without asserting applicability',async()=>{
 let url,options;const r=await discover(' Anker ','A1263',async(u,o)=>{url=u;options=o;return{ok:true,json:async()=>snapshot.rows};});
 assert.equal(new URL(url).searchParams.get('RecallTitle'),'Anker');assert.equal(options.credentials,'omit');assert.equal(r.mode,'LIVE_API');assert.equal(r.notices[0].url,actual.input.notice_url);assert.equal(r.notices[0].state,undefined);
});
test('discovery fails explicitly for unavailable, malformed and unusable responses without silently loading a fixture',async()=>{
 for(const fetcher of [async()=>{throw Error('offline')},async()=>({ok:false,status:503}),async()=>({ok:true,json:async()=>({error:'bad'})}),async()=>({ok:true,json:async()=>[{Title:'evil',URL:'https://evil.test'}]})])await assert.rejects(()=>discover('Anker','',fetcher),/unavailable/);
 await assert.rejects(()=>discover('a'),/2–120/);
 const empty=await discover('none','',async()=>({ok:true,json:async()=>[]}));assert.equal(empty.total,0);
});
test('discovery rejects deceptive URLs, deduplicates and renders untrusted titles as plain data',()=>{
 for(const u of ['http://www.cpsc.gov/Recalls/2025/Test','https://www.cpsc.gov.evil.test/Recalls/2025/Test',actual.input.notice_url+'#x','javascript:alert(1)'])assert.throws(()=>officialURL(u));
 assert.equal(normalizeNotices([...snapshot.rows,...snapshot.rows]).length,notices.length);
 assert.equal(rankNotices(notices,'Anker','A1263')[0].url,actual.input.notice_url);
});
test('multi-notice summary keeps unchecked notices unresolved and links only exact product inputs',async()=>{
 const c=make();selected(c);addNotice(c,notices.find(n=>n.url!==actual.input.notice_url));
 assert.equal(await saveRecord(c,actual,contract),true);
 assert.deepEqual(summary(c),{POTENTIAL_MATCH:0,NEEDS_DETAILS:1,OUTSIDE_THIS_NOTICE:0,UNCHECKED:1});
 assert.equal(await saveRecord(c,{...actual,input:{...actual.input,product:{...product,model:'other'}}},contract).catch(()=>false),false);
 assert.equal(missingDetails(actual).length,2);
});
test('follow-up preserves old evidence, generates a new request and never carries forward results',async()=>{
 const c=make();selected(c);await saveRecord(c,actual,contract);const original=JSON.stringify(c.revisions[0]),id1=requestFor(c,actual.input.notice_url).requestId;
 startRevision(c,{...product,original_sale:'March 2022'});
 assert.equal(JSON.stringify(c.revisions[0]),original);assert.notEqual(requestFor(c,actual.input.notice_url).requestId,id1);assert.equal(summary(c).UNCHECKED,1);
 assert.deepEqual(compareRevision(c)[0],{url:actual.input.notice_url,before:'NEEDS_DETAILS',after:'UNCHECKED',dimensions:[]});
 assert.equal(await saveRecord(c,actual,contract),false);
});
test('case bounds, duplicate notices and unchanged follow-ups are enforced',()=>{
 const c=make();selected(c);selected(c);assert.equal(activeRevision(c).notices.length,1);
 for(let i=0;i<7;i++)addNotice(c,{url:`https://www.cpsc.gov/Recalls/2025/Test-${i}`});assert.throws(()=>addNotice(c,{url:'https://www.cpsc.gov/Recalls/2025/Overflow'}),/eight/);
 assert.throws(()=>startRevision(c,product),/Update/);assert.throws(()=>requestFor(c,'https://www.cpsc.gov/Recalls/2025/Unknown'),/first/);
});
test('saved records restore with internal hashes but tampered inputs, provenance and record changes are rejected',async()=>{
 const c=make();selected(c);await saveRecord(c,actual,contract);await saveRecord(c,actual,contract);assert.equal(activeRevision(c).records.length,1);
 assert.deepEqual(await restoreCase(JSON.stringify(c)),c);
 for(const mutate of [x=>x.revisions[0].records[0].record.state='POTENTIAL_MATCH',x=>x.revisions[0].product.model='wrong',x=>x.revisions[0].records[0].chain_id=1,x=>x.revisions[0].records[0].digest='bad',x=>x.active=0]){const copy=structuredClone(c);mutate(copy);await assert.rejects(()=>restoreCase(JSON.stringify(copy)));}
});
test('follow-up compares changed dimension labels while retaining both records',async()=>{
 const c=make();selected(c);await saveRecord(c,actual,contract);startRevision(c,{...product,model:'A0000'});
 const next=structuredClone(actual);next.request_id='followup';next.input.product.model='A0000';next.input_sha256=await sha256(canonical(next.input));next.assessment.variant.label='MISMATCH';next.assessment.variant.quote=actual.notice.slice(0,20);next.state='OUTSIDE_THIS_NOTICE';
 await saveRecord(c,next,contract);assert.deepEqual(compareRevision(c)[0].dimensions,['variant']);assert.equal(compareRevision(c)[0].after,'OUTSIDE_THIS_NOTICE');assert.equal(c.revisions[0].records[0].record.state,'NEEDS_DETAILS');
});
test('workbench DOM searches two notices, prepares a unique request, guards edits and preserves follow-up',async()=>{
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test/'}),w=dom.window,prior={document:globalThis.document,fetch:globalThis.fetch};globalThis.document=w.document;
 const $=id=>w.document.getElementById(id),rows=snapshot.rows.filter(x=>x.URL===actual.input.notice_url||x.RecallID===10067);
 globalThis.fetch=async()=>({ok:true,json:async()=>rows});let p=structuredClone(product),filled,shown;
 const work=await initWorkbench({desk:{},getProduct:()=>p,fill:d=>{filled=d;p=d.product},show:(r,live)=>{shown={r,live}},storage:memory()});
 const click=async id=>{await $(id).onclick();};
 try{
 await click('discover');assert.equal($('candidates').querySelectorAll('article').length,2);
 for(const b of $('candidates').querySelectorAll('button'))await b.onclick();assert.equal(work.getCase().revisions[0].notices.length,2);
 await $('case-content').querySelector('button').onclick();assert.equal(filled.notice_url,actual.input.notice_url);const id=$('request_id').value;work.guard(filled,id);assert.throws(()=>work.guard({...filled,product:{...p,model:'wrong'}},id),/changed/);
 await work.capture(actual,contract);assert.match($('case-content').textContent,/1 needs details/);assert.match($('case-content').textContent,/1 unchecked/);
 await [...$('case-content').querySelectorAll('button')].find(b=>b.textContent==='Inspect evidence').onclick();assert.equal(shown.live,true);
 p={...p,original_sale:'March 2022'};await click('case-followup');assert.equal(work.getCase().revisions.length,2);assert.equal(work.getCase().revisions[1].records.length,0);assert.match($('case-content').textContent,/NEEDS DETAILS → UNCHECKED/);
 }finally{globalThis.document=prior.document;globalThis.fetch=prior.fetch;w.close();}
});
test('restored case evidence stays cached until an exact verified chain re-read succeeds',async()=>{
 const c=make();selected(c);await saveRecord(c,actual,contract);const s=memory();s.setItem('recallscope.investigation.v1',JSON.stringify(c));
 const dom=new JSDOM(fs.readFileSync('index.html','utf8')),prior=globalThis.document;globalThis.document=dom.window.document;let live,binds=0;
 const work=await initWorkbench({desk:{bind:async()=>binds++,read:async()=>actual},getProduct:()=>product,fill:()=>{},show:(r,l)=>live=l,storage:s});const $=id=>dom.window.document.getElementById(id);
 try{await [...$('case-content').querySelectorAll('button')].find(x=>x.textContent==='Inspect evidence').onclick();assert.equal(live,'cached');await $('case-reverify').onclick();assert.equal(binds,1);await [...$('case-content').querySelectorAll('button')].find(x=>x.textContent==='Inspect evidence').onclick();assert.equal(live,true);assert.equal(work.getCase().active,1);}finally{globalThis.document=prior;dom.window.close();}
});
