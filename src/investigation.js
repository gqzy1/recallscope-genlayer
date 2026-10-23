import {canonical, sha256, validateInput, validateRecord, dimensions} from './core.js';
import {officialURL} from './discovery.js';
export const CASE_KEY = 'recallscope.investigation.v1';
const same = (a,b) => canonical(a) === canonical(b);
export const clone = x => JSON.parse(JSON.stringify(x));
export function validateProduct(product) {
  validateInput({notice_url:'https://www.cpsc.gov/Recalls/2025/Product',product});
  return product;
}
export function createCase(product, id = globalThis.crypto.randomUUID().replaceAll('-','').slice(0,12)) {
  validateProduct(product);
  if (!/^[a-z0-9]{8,16}$/.test(id)) throw Error('Invalid investigation ID.');
  return {protocol:'recallscope-investigation-1',id,created_at:new Date().toISOString(),revisions:[{number:1,product:clone(product),notices:[],records:[]}],active:1};
}
export const activeRevision = c => c.revisions[c.active-1];
export function addNotice(c, notice) {
  const r=activeRevision(c),url=officialURL(notice.url);
  if(r.notices.some(n=>n.url===url)) return;
  if(r.notices.length>=8) throw Error('Each investigation supports up to eight notices.');
  r.notices.push({url,title:String(notice.title||'Official recall notice').slice(0,600)});
}
export function startRevision(c, product) {
  validateProduct(product);
  if(same(activeRevision(c).product,product)) throw Error('Update at least one product fact before starting a follow-up.');
  if(c.revisions.length>=16) throw Error('This investigation has reached its 16-revision limit.');
  c.revisions.push({number:c.revisions.length+1,product:clone(product),notices:clone(activeRevision(c).notices),records:[]});c.active=c.revisions.length;
}
export function requestFor(c,url) {
  const r=activeRevision(c),i=r.notices.findIndex(n=>n.url===url);
  if(i<0) throw Error('Add this notice to the investigation first.');
  return {requestId:`case-${c.id}-r${r.number}-n${i+1}`,input:{notice_url:url,product:clone(r.product)}};
}
export async function saveRecord(c, record, contract) {
  await validateRecord(record);
  if(!/^0x[\da-fA-F]{40}$/.test(contract??'')) throw Error('Missing verified contract address.');
  const r=activeRevision(c);
  if(!same(record.input.product,r.product)||!r.notices.some(n=>n.url===record.input.notice_url)) return false;
  const key=`${contract.toLowerCase()}::${record.owner}::${record.request_id}`;
  const digest=await sha256(canonical(record));
  const old=r.records.find(x=>x.key===key);
  if(old){if(old.digest!==digest)throw Error('Immutable record changed.');return true;}
  if(r.records.length>=32)throw Error('Revision record limit reached.');
  r.records.push({key,contract,chain_id:61999,digest,record:clone(record)});return true;
}
export function summary(c) {
  const r=activeRevision(c),latest=r.notices.map(n=>r.records.filter(x=>x.record.input.notice_url===n.url).at(-1)?.record);
  const counts={POTENTIAL_MATCH:0,NEEDS_DETAILS:0,OUTSIDE_THIS_NOTICE:0,UNCHECKED:0};
  for(const record of latest)counts[record?.state??'UNCHECKED']++;
  return counts;
}
export function missingDetails(record) {
  return dimensions.filter(k=>record.assessment[k].label==='UNKNOWN').map(k=>({dimension:k,reason:record.assessment[k].reason}));
}
export function compareRevision(c) {
  if(c.active<2)return [];
  const before=c.revisions[c.active-2],after=activeRevision(c);
  return after.notices.map(n=>{
    const a=before.records.filter(x=>x.record.input.notice_url===n.url).at(-1)?.record;
    const b=after.records.filter(x=>x.record.input.notice_url===n.url).at(-1)?.record;
    return {url:n.url,before:a?.state??'UNCHECKED',after:b?.state??'UNCHECKED',dimensions:dimensions.filter(k=>a&&b&&a.assessment[k].label!==b.assessment[k].label)};
  });
}
export async function restoreCase(raw) {
  if(typeof raw!=='string'||raw.length>4000000)throw Error('Investigation file exceeds bounds.');
  const c=JSON.parse(raw);
  if(c?.protocol!=='recallscope-investigation-1'||!/^[a-z0-9]{8,16}$/.test(c.id)||!Array.isArray(c.revisions)||c.revisions.length<1||c.revisions.length>16||c.active!==c.revisions.length)throw Error('Invalid investigation.');
  for(const [i,r]of c.revisions.entries()){
    validateProduct(r.product);
    if(r.number!==i+1||!Array.isArray(r.notices)||r.notices.length>8||!Array.isArray(r.records)||r.records.length>32)throw Error('Invalid revision.');
    const urls=new Set();for(const n of r.notices){officialURL(n.url);if(urls.has(n.url)||typeof n.title!=='string'||n.title.length>600)throw Error('Invalid notice list.');urls.add(n.url);}
    const keys=new Set();for(const x of r.records){
      await validateRecord(x.record);
      if(!/^0x[\da-fA-F]{40}$/.test(x.contract)||x.chain_id!==61999||x.key!==`${x.contract.toLowerCase()}::${x.record.owner}::${x.record.request_id}`||keys.has(x.key)||await sha256(canonical(x.record))!==x.digest||!same(x.record.input.product,r.product)||!urls.has(x.record.input.notice_url))throw Error('Invalid investigation record.');
      keys.add(x.key);
    }
  }
  return c;
}
