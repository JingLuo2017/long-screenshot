const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../editor.js');require('../updates.js');
const VERSION=ScrollshotUpdates.VERSION,NEXT='1.9.2',scope='https://example.test/long-screenshot/';
const cacheName=ScrollshotUpdates.cacheName(scope);
assert.equal(ScrollshotUpdates.compareVersions('1.10.0','1.9.9'),1);
assert.equal(ScrollshotUpdates.compareVersions(VERSION,VERSION),0);
assert.equal(ScrollshotUpdates.compareVersions('1.9.0',VERSION),-1);
assert.notEqual(cacheName,ScrollshotUpdates.cacheName('https://example.test/other/'));
for(const old of [1,1.25,2,4])for(const next of [1,1.5,3,4])for(const scroll of [0,100,1400]){
 const anchor=120,s=ScrollshotViewer.zoomAnchor(scroll,anchor,old,next);
 assert(Math.abs((s+anchor)/next-(scroll+anchor)/old)<1e-8);
}
assert.equal(ScrollshotViewer.clamp(8,1,4),4);assert.equal(ScrollshotViewer.clamp(.4,1,4),1);

const page=fs.readFileSync('index.html','utf8');
const links=[...page.matchAll(/<script src="(\.\/[^"]+)"|<link\s[^>]*href="(\.\/[^"]+)"/g)].map(m=>m[1]||m[2]);
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const staticURLs=[...new Set([...links,...manifest.icons.map(x=>x.src)].map(x=>new URL(x,scope).href))];
async function cacheTest(failure){
 const handlers={},files=new Map(),requests=[];
 let activated=0,claimed=0,networkAvailable=true,task,reportedVersion;
 const prior=ScrollshotUpdates.cacheName(scope,'1.9.0'),older=ScrollshotUpdates.cacheName(scope,'1.8.7'),foreign=ScrollshotUpdates.cacheName('https://example.test/other/');
 const entries=new Set([prior,older,foreign]);
 async function fetch(url){
  if(!networkAvailable)throw Error('Network is unavailable');
  const key=String(url);
  if(key===scope)return new Response(failure==='stale'?page.replace(`content="${VERSION}"`,'content="1.9.0"'):page);
  if(failure==='asset'||!staticURLs.includes(key))throw Error('Asset unavailable');
  requests.push(key);
  return new Response('asset '+key);
 }
 const caches={
  open:async name=>{assert.equal(name,cacheName);entries.add(name);return {
   put:async(k,v)=>files.set(String(k),v),match:async k=>files.get(typeof k==='string'?k:k.url)?.clone(),
   addAll:async urls=>{for(const url of urls)files.set(url,await fetch(url))},
  }},
  delete:async name=>{entries.delete(name);if(name===cacheName)files.clear();return true},keys:async()=>[...entries],
 };
 const self={registration:{scope},clients:{claim:async()=>claimed++},skipWaiting:async()=>activated++,addEventListener:(n,fn)=>handlers[n]=fn};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,caches,fetch,URL,Response,Promise});
 handlers.install({waitUntil:t=>task=t});
 if(failure){await assert.rejects(task);assert(!entries.has(cacheName));assert.equal(files.size,0);assert(entries.has(prior));return}
 await task;assert.equal(activated,0,'install must not automatically supersede an active version');
 assert.deepEqual(new Set(requests),new Set(staticURLs),'precache all actual page and manifest resources');
 assert.equal(await files.get(scope+'__ready__').text(),VERSION);
 handlers.message({data:{type:'GET_VERSION'},ports:[{postMessage:x=>reportedVersion=x.version}]});
 assert.equal(reportedVersion,VERSION);
 const activate=version=>handlers.message({data:{type:'ACTIVATE_VERSION',version},waitUntil:t=>task=t});
 activate('9.0.0');assert.equal(activated,0);activate(VERSION);await task;assert.equal(activated,1);
 handlers.activate({waitUntil:t=>task=t});await task;assert.equal(claimed,1);
 assert.deepEqual(entries,new Set([prior,foreign,cacheName]));
 networkAvailable=false;
 const respond=(url,mode,method='GET')=>{let response;handlers.fetch({request:{url,mode,method},respondWith:p=>response=p});return response};
 for(const url of [scope,scope+'?home=1',scope+'index.html'])assert.equal(await (await respond(url,'navigate')).text(),page);
 for(const url of staticURLs)assert.equal(await (await respond(url,'cors')).text(),'asset '+url);
 assert.equal(respond(scope+'version.json?check=1','cors'),undefined,'updates must bypass the cache');
 assert.equal(respond(scope+'user-recording.mp4','cors'),undefined,'user recordings are not cached');
 assert.equal(respond(scope,'navigate','POST'),undefined);
}
class Element extends EventTarget{constructor(){super();this.disabled=false;this.hidden=false;this.open=false;this.children=[];this.textContent=''}replaceChildren(){this.children=[]}appendChild(el){this.children.push(el)}showModal(){this.open=true}close(){this.open=false}click(){this.dispatchEvent(new Event('click'))}}
async function dialogTest(){
 const els={},observers=[],doc=new EventTarget();doc.getElementById=id=>els[id]||(els[id]=new Element());doc.createElement=()=>new Element();doc.querySelector=()=>els['update-dialog']?.open?els['update-dialog']:null;
 let locked=false,data=false,confirmResult=false,confirmCount=0,reloads=0,activation=0,registered=0,marker=VERSION;
 const sw=new EventTarget(),worker={postMessage(message,ports){if(message.type==='GET_VERSION')ports[0].send({version:NEXT});else{activation++;sw.dispatchEvent(new Event('controllerchange'))}}},reg=new EventTarget();
 reg.waiting=worker;reg.update=async()=>{};sw.register=async u=>{assert.equal(String(u),scope+'sw.js');registered++;return reg};sw.ready=Promise.resolve(reg);
 class Channel{constructor(){this.port1={onmessage:null,close(){}};this.port2={send:d=>queueMicrotask(()=>this.port1.onmessage?.({data:d}))}}}
 const win=new EventTarget(),navigator={onLine:true,serviceWorker:sw};
 const ctx={document:doc,window:win,navigator,location:{href:scope,reload(){reloads++}},sessionStorage:{getItem(){return null},setItem(){}},MutationObserver:class{constructor(fn){this.fn=fn}observe(){observers.push(this.fn)}},MessageChannel:Channel,URL,Response,Date,Promise,fetch:async()=>new Response(JSON.stringify({version:NEXT,notes:['New release']})),confirm:()=>{confirmCount++;return confirmResult},setInterval(){},setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t},clearTimeout,caches:{match:async(u,opts)=>{assert.equal(String(u),scope+'__ready__');assert.equal(opts.cacheName,cacheName);return marker&&new Response(marker)}}};
 ctx.globalThis=ctx;vm.runInNewContext(fs.readFileSync('updates.js','utf8'),ctx);ctx.ScrollshotUpdates.mount({isBusy:()=>locked,hasData:()=>data});
 const flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate)};
 await flush();assert.equal(registered,1);assert.equal(els['offline-status'].textContent,'缓存就绪后可离线使用');
 sw.controller={};sw.dispatchEvent(new Event('controllerchange'));await flush();assert.equal(els['offline-status'].textContent,'可离线使用');
 navigator.onLine=false;win.dispatchEvent(new Event('offline'));await flush();assert.equal(els['offline-status'].textContent,'可离线使用');
 marker=null;win.dispatchEvent(new Event('offline'));await flush();assert.equal(els['offline-status'].textContent,'缓存就绪后可离线使用');
 navigator.onLine=true;
 assert.equal(els['update-dialog'].open,true);assert.equal(els['update-version'].textContent,'v'+NEXT);assert.equal(els['update-notes'].children[0].textContent,'New release');
 els['update-later'].click();assert.equal(els['update-dialog'].open,false);
 els['show-update'].click();els['update-close'].click();assert.equal(els['update-dialog'].open,false);
 els['show-update'].click();locked=true;observers.forEach(f=>f());assert.equal(els['update-now'].disabled,true);els['update-now'].click();await flush();assert.equal(activation,0);
 locked=false;data=true;observers.forEach(f=>f());els['update-now'].click();await flush();assert.equal(confirmCount,1);assert.equal(activation,0);
 confirmResult=true;els['update-now'].click();await flush();assert.equal(activation,1);assert.equal(reloads,1);
}
(async()=>{await cacheTest();await cacheTest('asset');await cacheTest('stale');await dialogTest();console.log('PASS complete offline cache, install failures, short readiness status, scoped cache cleanup and update confirmations')})().catch(e=>{console.error(e);process.exitCode=1});
