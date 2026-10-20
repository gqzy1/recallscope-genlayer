// Read-only verification: exact source, finalized transaction and stored evidence hashes.
import fs from 'node:fs';
import {ChainDesk} from '../src/chain.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../deployment.json',import.meta.url)));
const memory=new Map();
const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const desk=new ChainDesk({expectedHash:manifest.source_sha256,manifest,storage});
await desk.bind(manifest.address);
for(const item of manifest.verified_cases??[manifest.example]){
 const result=await desk.track(item.transaction);
 if(!result.record)throw Error('Transaction not finalized successfully: '+item.transaction);
 console.log(JSON.stringify({request_id:result.record.request_id,state:result.record.state,transaction:result.hash,source_sha256:manifest.source_sha256}));
}
