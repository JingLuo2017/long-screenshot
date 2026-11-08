const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element extends EventTarget{constructor(){super();this.textContent='';this.children=[];this.open=false}replaceChildren(){this.children=[]}appendChild(el){this.children.push(el)}showModal(){this.open=true}close(){this.open=false}}
(async()=>{
const els={},get=id=>els[id]||(els[id]=new Element()),document=new EventTarget();document.getElementById=get;document.createElement=()=>new Element();document.querySelector=()=>null;
let clock=0,nextId=0,mode='latest',pending;const tasks=new Map(),navigator={onLine:false};
const ctx={document,window:new EventTarget(),navigator,location:{href:'https://example.test/app/'},sessionStorage:{getItem(){return null},setItem(){}},MutationObserver:class{observe(){}},URL,Date,Promise,setInterval(){},setTimeout(fn,ms){const id=++nextId;tasks.set(id,{fn,at:clock+ms});return id},clearTimeout(id){tasks.delete(id)},fetch:async()=>{if(mode==='error')throw Error('offline');if(mode==='pending')await new Promise(r=>pending=r);return{ok:true,json:async()=>({version:mode==='new'?'1.8.6':'1.8.5',notes:['Test release']})}}};ctx.globalThis=ctx;
const advance=ms=>{clock+=ms;for(const[id,t]of[...tasks])if(t.at<=clock){tasks.delete(id);t.fn()}},flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate)};
vm.runInNewContext(fs.readFileSync('updates.js','utf8'),ctx);const api=ctx.ScrollshotUpdates.mount();
await api.check(true);assert.match(get('update-check-status').textContent,/当前离线/);advance(3499);assert(get('update-check-status').textContent);advance(1);assert.equal(get('update-check-status').textContent,'');
navigator.onLine=true;await api.check(true);assert.match(get('update-check-status').textContent,/最新版本/);advance(3500);assert.equal(get('update-check-status').textContent,'');
mode='error';await api.check(true);assert.match(get('update-check-status').textContent,/重试/);advance(3500);assert.equal(get('update-check-status').textContent,'');
mode='new';await api.check(true);assert(get('update-dialog').open);advance(3500);assert.equal(get('update-check-status').textContent,'');assert(get('update-dialog').open,'only the transient check result should disappear');assert.equal(get('update-banner').hidden,false);
mode='latest';await api.check(true);advance(2000);mode='pending';const checking=api.check(true);assert.equal(get('check-updates').disabled,true);advance(3500);assert.equal(get('update-check-status').textContent,'正在检查更新…','stale timer must not hide loading');pending();await checking;await flush();assert.equal(get('check-updates').disabled,false);advance(3499);assert.match(get('update-check-status').textContent,/最新版本/);advance(1);assert.equal(get('update-check-status').textContent,'');
console.log('PASS 3.5s dismissal: latest, offline, failure, update-found; dialogs persist, loading and repeated checks reset timers');
})().catch(error=>{console.error(error);process.exitCode=1});
