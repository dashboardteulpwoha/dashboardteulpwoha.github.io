
const DBN='lapor-sr';
function idb(){return new Promise((ok,no)=>{const r=indexedDB.open(DBN,1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('antri',{keyPath:'uid'});d.createObjectStore('cfg')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function tx(st,mode,fn){const d=await idb();return new Promise((ok,no)=>{const t=d.transaction(st,mode),s=t.objectStore(st);let h;const r=fn(s);if(r)r.onsuccess=()=>{h=r.result};t.oncomplete=()=>ok(h);t.onerror=()=>no(t.error)})}
const cfgAmbil=k=>tx('cfg','readonly',s=>s.get(k)),cfgSimpan=(k,v)=>tx('cfg','readwrite',s=>s.put(v,k));
const antriSemua=()=>tx('antri','readonly',s=>s.getAll()),antriTambah=x=>tx('antri','readwrite',s=>s.put(x)),antriHapus=u=>tx('antri','readwrite',s=>s.delete(u));
const diGithub=()=>/\.github\.io$/.test(self.location.hostname);
async function cariBase(paksa){/* alamat server bot terbaru */
 if(!diGithub()&&!paksa)return self.location.origin;
 try{let url=null;
  if(diGithub()){const j=await (await fetch(new URL('../link.json',self.location.href).href+'?t='+Date.now(),{cache:'no-store'})).json();url=j.url}
  else{const repo=await cfgAmbil('repo');if(repo){const j=await (await fetch('https://api.github.com/repos/'+repo+'/contents/link.json?t='+Date.now(),{cache:'no-store'})).json();url=JSON.parse(atob(j.content.replace(/\s/g,''))).url}}
  if(url){url=url.replace(/\/+$/,'');await cfgSimpan('base',url);return url}}catch(e){}
 const b=await cfgAmbil('base');return b||(diGithub()?null:self.location.origin)}
async function kirimSatu(base,token,it){if(!base)return 'net';
 try{const r=await fetch(base+(it.tipe==='tl'?'/api/lapor/tl':'/api/lapor'),{method:'POST',headers:{'Content-Type':'application/json','X-Lapor':'1','X-Token':token},body:JSON.stringify(it)});
  if(r.status==401)return 'login';const j=await r.json().catch(()=>({}));if(r.ok&&j.ok)return 'ok';if(r.status>=500||r.status==429)return 'net';return j.pesan||('ditolak server ('+r.status+')')}catch(e){return 'net'}}
async function tandaiRiw(uid,st){const r=(await cfgAmbil('riw'))||[];const x=r.find(a=>a.uid==uid);if(x){x.st=st;await cfgSimpan('riw',r)}}
let SEDANG=false;
async function kirimAntrian(){if(SEDANG)return {terkirim:0,galat:'sibuk'};SEDANG=true;let n=0,galat='';
 try{const token=await cfgAmbil('token');const L=(await antriSemua()).sort((a,b)=>String(a.dibuat).localeCompare(String(b.dibuat)));
  if(!L.length)return {terkirim:0,galat:''};if(!token)return {terkirim:0,galat:'login'};
  let base=await cariBase(false);
  for(const it of L){let r=await kirimSatu(base,token,it);
   if(r==='net'){const b2=await cariBase(true);if(b2&&b2!==base){base=b2;r=await kirimSatu(base,token,it)}}
   if(r==='ok'){await antriHapus(it.uid);await tandaiRiw(it.uid,'ok');n++}
   else if(r==='login'){galat='login';await cfgSimpan('token',null);break}
   else if(r==='net'){galat='net';break}
   else{it.galat=r;await antriTambah(it);await tandaiRiw(it.uid,'galat');galat=r}}
 }catch(e){galat='net'}finally{SEDANG=false}
 return {terkirim:n,galat}}

const CACHE='lapor-sr-006107cc31',ASET=['./','./manifest.json','./ikon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASET)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('lapor-sr-')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const q=e.request,u=new URL(q.url);if(q.method!=='GET'||u.origin!==self.location.origin)return;
 const skop=new URL('./',self.location.href).pathname;if(!u.pathname.startsWith(skop)||u.pathname.endsWith('sw.js'))return;
 if(q.mode==='navigate'){/* jaringan dulu (maks 6 detik), bila gagal pakai salinan di HP */
  e.respondWith(new Promise(ok=>{let selesai=false;const cad=()=>caches.match('./').then(r=>{if(!selesai){selesai=true;ok(r||new Response('Offline',{status:503}))}});
   const t=setTimeout(cad,6000);fetch(q).then(r=>{clearTimeout(t);if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put('./',c))}if(!selesai){selesai=true;ok(r)}}).catch(()=>{clearTimeout(t);cad()})}));return}
 e.respondWith(caches.match(q,{ignoreSearch:true}).then(r=>r||fetch(q)))});
async function kabari(h){const cs=await self.clients.matchAll({includeUncontrolled:true});cs.forEach(c=>c.postMessage({tipe:'antrian',h}))}
self.addEventListener('sync',e=>{if(e.tag==='kirim-lapor')e.waitUntil(kirimAntrian().then(kabari))});
self.addEventListener('message',e=>{if(e.data==='kirim')e.waitUntil(kirimAntrian().then(kabari))});
