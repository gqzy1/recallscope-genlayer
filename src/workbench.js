import {discover,normalizeNotices,rankNotices,officialURL} from './discovery.js';
import {CASE_KEY,createCase,activeRevision,addNotice,startRevision,requestFor,saveRecord,summary,missingDetails,compareRevision,restoreCase,clone} from './investigation.js';
import {canonical} from './core.js';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
const link=(text,url)=>{const a=node('a',text,'text-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
export async function initWorkbench({desk,getProduct,fill,show,storage=globalThis.localStorage}) {
  const $=id=>document.getElementById(id),status=m=>{$('case-feedback').textContent=m;};
  let investigation=null,searchResult=null,working=false,prepared=null;
  // A restored file carries no network authority. Records are re-read before use as live evidence.
  const verified=new Set();
  const persist=()=>{try{storage.setItem(CASE_KEY,JSON.stringify(investigation));}catch{status('Browser storage is full or unavailable. Export the investigation before leaving.');}};
  const run=async fn=>{if(working)return;working=true;try{await fn();}catch(e){status(e.message);}finally{working=false;}};
  const productMatches=()=>canonical(getProduct())===canonical(activeRevision(investigation).product);
  function ensureCase(){if(!investigation){investigation=createCase(getProduct());persist();}if(!productMatches())throw Error('Product facts differ from this investigation. Choose Save follow-up revision or start a new investigation.');}
  function prepare(url){ensureCase();const q=requestFor(investigation,url);fill(q.input);$('request_id').value=q.requestId;prepared={id:investigation.id,revision:investigation.active,url};status(`Prepared ${q.requestId}. Review the notice and facts below. Submit once and check finalization, or use Studio then Track & check. Each notice requires its own signed transaction.`);$('inspection').scrollIntoView?.({behavior:'smooth',block:'start'});}
  function renderSearch(){
    const box=$('candidates');box.replaceChildren();if(!searchResult)return;$('candidates').parentElement.open=true;
    box.append(node('p',`${searchResult.mode==='LIVE_API'?'LIVE OFFICIAL SEARCH':'DATED SAVED CATALOGUE'} · ${searchResult.retrieved_at} · ${searchResult.total} candidate notices`,'source-line'));
    box.append(node('p','Ranked by text overlap, not an AI finding. Review each candidate. This search does not cover every recall.','note'));
    box.append(link('View source query ↗',searchResult.source));
    if(!searchResult.total)box.append(node('p','No candidates returned. This does not establish that the product is free of recalls.'));
    for(const n of searchResult.notices.slice(0,40)){
      const article=node('article',null,'candidate');article.append(node('p',`${n.date} · Recall ${n.number||'—'}`,'source-line'),node('h3',n.title),node('p',n.description.slice(0,340)+(n.description.length>340?'…':'')),link('Official notice ↗',n.url),button('Add to investigation',()=>run(async()=>{ensureCase();addNotice(investigation,n);persist();render();status('Notice added. Prepare each selected notice for independent assessment.');})));
      box.append(article);
    }
    if(searchResult.total>40)box.append(node('p','Showing the top 40 candidates. Narrow the title keyword or add an official URL directly.','note'));
  }
  function render(){
    const box=$('case-content');box.replaceChildren();$('case-export').disabled=!investigation;$('case-followup').disabled=!investigation;$('case-reverify').disabled=!investigation;
    if(!investigation){box.append(node('p','Search official notices, then add candidates to begin a product investigation. Product facts are taken from the inspection form below.'));return;}
    const r=activeRevision(investigation),counts=summary(investigation);
    box.append(node('p',`INVESTIGATION ${investigation.id} · REVISION ${r.number} · ${r.product.brand} ${r.product.model}`,'source-line'));
    const stats=node('div',null,'case-stats');for(const [key,value]of Object.entries(counts))stats.append(node('span',`${value} ${key.replaceAll('_',' ').toLowerCase()}`));box.append(stats);
    box.append(node('p','Counts refer only to selected notices in this revision. Unchecked notices and missing details remain unresolved. No safety or resale clearance is issued.','note'));
    if(!r.notices.length)box.append(node('p','No notices selected yet. Search above or add a canonical official URL.'));
    for(const n of r.notices){
      const row=node('article',null,'case-notice'),entry=r.records.filter(x=>x.record.input.notice_url===n.url).at(-1),record=entry?.record;
      row.append(node('h3',n.title),link('Official notice ↗',n.url));
      row.append(node('p',record?record.state.replaceAll('_',' '):'UNCHECKED',record?'case-state':'note'));
      if(record){
        row.append(node('p',verified.has(entry.key)?'Re-read from verified contract in this session.':'Saved record · cached locally · re-read to verify current chain provenance.','source-line'));
        for(const m of missingDetails(record))row.append(node('p',`${m.dimension}: ${m.reason}`,'missing-detail'));
        row.append(button('Inspect evidence',()=>show(record,verified.has(entry.key)?true:'cached',entry.contract)));
      }
      row.append(button(record?'Prepare another assessment':'Prepare assessment',()=>run(async()=>prepare(n.url))));box.append(row);
    }
    if(r.number>1){const changes=node('div',null,'revision-diff');changes.append(node('h3','Follow-up comparison'));
      const previous=investigation.revisions[r.number-2];
      for(const k of Object.keys(r.product))if(r.product[k]!==previous.product[k])changes.append(node('p',`${k}: ${previous.product[k]||'(not supplied)'} → ${r.product[k]||'(not supplied)'}`));
      for(const diff of compareRevision(investigation)){const p=node('p',`${diff.before.replaceAll('_',' ')} → ${diff.after.replaceAll('_',' ')}${diff.dimensions.length?' · changed labels: '+diff.dimensions.join(', '):''}`);p.append(' ',link('Notice ↗',diff.url));changes.append(p);}box.append(changes);
    }
    const history=node('details');history.append(node('summary',`${investigation.revisions.length} saved revision(s) · immutable record snapshots`));
    for(const rev of investigation.revisions){history.append(node('h4',`Revision ${rev.number}: ${rev.product.brand} ${rev.product.model} · ${rev.records.length} records`));for(const x of rev.records)history.append(button(`${x.record.request_id} · ${x.record.state.replaceAll('_',' ')}`,()=>show(x.record,verified.has(x.key)?true:'cached',x.contract)));}box.append(history);
  }
  $('discover').onclick=()=>run(async()=>{status('Searching the official CPSC title index…');searchResult=null;renderSearch();searchResult=await discover($('search-brand').value,$('search-model').value);renderSearch();status('Candidates loaded. Select notices to investigate; ranking does not establish recall applicability.');});
  $('saved-catalogue').onclick=()=>run(async()=>{const response=await fetch('data/cpsc-anker.json');if(!response.ok)throw Error('Saved catalogue unavailable.');const saved=await response.json();const brand=$('search-brand').value.trim()||'Anker',model=$('search-model').value;searchResult={...saved,mode:'SAVED_CATALOGUE',model,total:saved.rows.length,notices:rankNotices(normalizeNotices(saved.rows),brand,model)};renderSearch();status(saved.scope+' Saved catalogue loaded explicitly; no live search or AI assessment was performed.');});
  $('use-product-search').onclick=()=>run(async()=>{const p=getProduct();$('search-brand').value=p.brand;$('search-model').value=p.model;status('Search fields copied from the product. Select Search official notices.');});
  $('add-manual').onclick=()=>run(async()=>{ensureCase();const url=officialURL($('manual-notice').value.trim());addNotice(investigation,{url,title:url.split('/').at(-1).replaceAll('-',' ')});persist();render();status('Official URL added. It has not been assessed.');});
  $('case-new').onclick=()=>run(async()=>{
    if(investigation){if($('case-new').dataset.confirm!=='yes'){$('case-new').dataset.confirm='yes';status('Export the current investigation if needed. Select Start new investigation again to replace this browser’s active case.');return;}}
    investigation=createCase(getProduct());prepared=null;verified.clear();$('case-new').dataset.confirm='';persist();render();status('New investigation created from current product facts.');
  });
  $('case-followup').onclick=()=>run(async()=>{if(!investigation)return;startRevision(investigation,getProduct());prepared=null;persist();render();status('Follow-up revision saved. Prior records are preserved. Prepare each notice again; earlier findings are not copied as new results.');});
  $('case-export').onclick=()=>{if(!investigation)return;const blob=new Blob([JSON.stringify({provenance:'LOCAL_INVESTIGATION_EXPORT',links:'LOCAL_ASSOCIATION_NOT_CONTRACT_ENFORCED',...investigation},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`recallscope-investigation-${investigation.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('case-reverify').onclick=()=>run(async()=>{
    if(!investigation)return;
    const entries=activeRevision(investigation).records;
    if(!entries.length)throw Error('No saved chain records to re-read yet.');
    for(const entry of entries){status('Verifying saved record '+entry.record.request_id+'…');verified.delete(entry.key);render();await desk.bind(entry.contract);const fresh=await desk.read(entry.record.owner,entry.record.request_id);if(!fresh||canonical(fresh)!==canonical(entry.record))throw Error('Saved record does not match the current finalized readback.');verified.add(entry.key);render();}
    status('Current revision records re-read from source-verified contracts. Reconnect your wallet before another write.');
  });
  try{const raw=storage.getItem(CASE_KEY);if(raw&&raw!=='null'){investigation=await restoreCase(raw);fill({notice_url:activeRevision(investigation).notices[0]?.url??$('notice_url').value,product:activeRevision(investigation).product});status('Saved investigation restored. Cached records need a fresh chain read for current provenance.');}}catch{status('Saved investigation could not be validated. Start a new investigation; the original storage has not been overwritten.');}
  render();
  return {
    async capture(record,contract){if(!investigation)return;try{if(await saveRecord(investigation,record,contract)){const key=`${contract.toLowerCase()}::${record.owner}::${record.request_id}`;verified.add(key);persist();render();status('Finalized record linked to this investigation revision.');}}catch(e){status(e.message);}},
    guard(input,requestId){if(!prepared)return;if(prepared.id!==investigation?.id||prepared.revision!==investigation.active)throw Error('Prepare the current investigation revision first.');const q=requestFor(investigation,prepared.url);if(requestId!==q.requestId||canonical(input)!==canonical(q.input))throw Error('Prepared investigation inputs changed. Save a follow-up revision or prepare the notice again before submitting.');},
    getCase:()=>clone(investigation)
  };
}
