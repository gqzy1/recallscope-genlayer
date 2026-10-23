import {initWorkbench} from './workbench.js';
import {initArt} from './art.js';
import {ChainDesk} from './chain.js';
import {validateInput,validateRecord,dimensions} from './core.js';
initArt();
const $=id=>document.getElementById(id);let shown=null,shownLive=false,shownContract=null,workbench=null;
const manifest=await fetch('deployment.json').then(r=>{if(!r.ok)throw Error('Missing deployment manifest');return r.json()});
const desk=new ChainDesk({expectedHash:manifest.source_sha256,manifest,onChange:m=>{$('network-feedback').textContent=m}});
const feedback=(m,network=false)=>{$(network?'network-feedback':'feedback').textContent=m};
const getProduct=()=>Object.fromEntries(['brand','model','batch','original_sale','region','details'].map(k=>[k,$(k).value.trim()]));
const data=()=>validateInput({notice_url:$('notice_url').value.trim(),product:getProduct()});
function fill(d){$('notice_url').value=d.notice_url;for(const[k,v]of Object.entries(d.product))$(k).value=v;}
async function sample(){const d=await fetch('examples/product.json').then(r=>r.json());fill(d);feedback('Example product loaded. View the worked example or submit your own facts to GenLayer.');}
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
function show(r,live,contract=desk.bound,capture=true){shown=r;shownLive=live;shownContract=live?contract:null;$('mode').textContent=live===true?'FINALIZED RECORD · GENLAYER':live==='cached'?'SAVED RECORD · RE-READ TO VERIFY':'WORKED EXAMPLE · NOT ONCHAIN';const box=$('result');box.replaceChildren(node('div',r.state.replaceAll('_',' '),'state'));if(live==='cached')box.append(node('p','Saved local snapshot. Re-read from the verified contract to establish current chain provenance.','note'));if(!live)box.append(node('p','Illustrative fixture, not a fresh check or network result.','note'));for(const k of dimensions){const a=r.assessment[k],row=node('article','','finding'),head=node('div','','finding-head');head.append(node('h4',k),node('span',a.label,'label'));row.append(head,node('p',a.reason));if(a.quote)row.append(node('blockquote',a.quote));box.append(row);}const link=node('a','Open official notice ↗','quiet');link.href=r.input.notice_url;link.target='_blank';link.rel='noopener noreferrer';box.append(link);if(live)box.append(node('p',`Owner ${r.owner}\nRequest ${r.request_id}\nNotice SHA256 ${r.notice_sha256}`,'result-meta'));$('export').disabled=false;if(live===true&&capture)void workbench?.capture(r,contract);}
async function run(fn,network=false){try{await fn()}catch(e){feedback(e.message,network)}}
$('sample').onclick=()=>run(sample);
$('live-example').onclick=()=>run(async()=>{if(!manifest.example||!manifest.address)throw Error('No finalized example is configured.');feedback('Verifying deployed source and reading the finalized record…');await desk.bind(manifest.address);const r=await desk.read(manifest.example.owner,manifest.example.request_id);if(!r)throw Error('The finalized example was not found.');show(r,true);feedback('Read directly from Stable Studionet. This example uses test product facts and a real official notice.');});
$('example').onclick=()=>run(async()=>{show(await fetch('examples/worked.json').then(r=>r.json()),false);feedback('Worked example displayed. It does not evaluate edits in the form.');});
$('inspection').addEventListener('input',()=>{if(shown){$('mode').textContent=shownLive?'INPUT EDITED · SAVED RECORD IS UNCHANGED':'INPUT EDITED · EXAMPLE IS UNCHANGED';}});
$('open-network').onclick=()=>$('network').showModal();$('close-network').onclick=()=>$('network').close();
$('bind').onclick=()=>run(async()=>{await desk.bind($('address').value.trim());feedback('Exact contract source verified. Connect your wallet to submit.',true)},true);
$('connect').onclick=()=>run(async()=>{const provider=window.okxwallet??window.ethereum;const account=await desk.connect(provider);feedback('Connected '+account,true)},true);
$('inspection').onsubmit=e=>{e.preventDefault();run(async()=>{const d=data();workbench?.guard(d,$('request_id').value);$('submit').disabled=true;try{const result=await desk.submit($('request_id').value,d);if(result.existing){show(result.existing,true);feedback('Existing finalized record loaded. No new transaction sent.');}else feedback('Transaction submitted: '+result.hash+'\nUse Check saved transaction to retrieve the finalized result.');}finally{$('submit').disabled=false;}})};
async function recheck(){const r=await desk.recheck();if(r.record){show(await validateRecord(r.record),true);feedback('Finalized successfully. The matching record was read back from GenLayer.');}else feedback(r.failed?'Transaction finalized without an accepted assessment. No result was committed.':'Still awaiting finalization. Do not submit again.');}
$('recheck').onclick=()=>run(recheck);$('attach').onclick=()=>run(async()=>{const hash=$('recovery-hash').value.trim();if(desk.pending){desk.attach(hash);await recheck();}else{const r=await desk.track(hash);if(r.record){show(r.record,true);feedback('Finalized Studio transaction verified and matching record read from GenLayer.');}else feedback(r.failed?'Transaction finalized without an accepted assessment.':'Transaction tracked. Check again until finalization.');}});
$('read').onclick=()=>run(async()=>{const r=await desk.read($('read-owner').value.trim(),$('read-id').value.trim());if(!r)throw Error('No finalized record at this owner and request ID.');show(r,true);feedback('Finalized record read from the verified contract.');});
$('export').onclick=()=>{if(!shown)return;const blob=new Blob([JSON.stringify({provenance:shownLive===true?'FINALIZED_CHAIN_READ':shownLive==='cached'?'CACHED_LOCAL_RECORD':'ILLUSTRATIVE_FIXTURE',contract:shownContract,...shown},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='recallscope-'+(shownLive?'record':'example')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
if(manifest.address)$('address').value=manifest.address;
if(desk.pending){$('address').value=desk.pending.address;feedback('A saved submission needs checking. Verify its original contract, then check the transaction. Do not resubmit.');}
await sample();
workbench=await initWorkbench({desk,getProduct,fill,show:(r,live,contract)=>show(r,live,contract,false)});
