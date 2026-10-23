// Refresh the deliberately limited, explicitly dated fallback catalogue.
import fs from 'node:fs/promises';
import {API, normalizeNotices} from '../src/discovery.js';
const source=new URL(API);source.searchParams.set('format','json');source.searchParams.set('RecallTitle','Anker');
const response=await fetch(source,{signal:AbortSignal.timeout(20000),redirect:'error'});
if(!response.ok)throw Error('CPSC HTTP '+response.status);
const rows=await response.json();
if(!normalizeNotices(rows).length)throw Error('No valid official notices; keeping the existing snapshot.');
const output={source:source.href,retrieved_at:new Date().toISOString(),query:'Anker',scope:'Saved title search for Anker only. Not a complete or current recall database.',rows};
await fs.writeFile(new URL('../data/cpsc-anker.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log('Saved '+rows.length+' dated title-search results.');
