const assert=require('node:assert/strict');
require('../flow.js');
class Element extends EventTarget{
 constructor(){super();this.dataset={};this.classList={toggle(){}};this.value='';this.textContent='';this.hidden=false;this.disabled=false;}
 showModal(){this.open=true;} close(value){this.open=false;if(value!==undefined)this.returnValue=value;this.dispatchEvent(new Event('close'));}
 setAttribute(){} removeAttribute(name){if(name==='data-kind')delete this.dataset.kind;} focus(){} scrollIntoView(){} querySelector(){return this;}
}
(async()=>{
 const elements={},get=id=>elements[id]||(elements[id]=new Element()),file=get('file'),pending=[];
 file.files=[];Object.defineProperty(file,'value',{set(value){if(value==='')file.files=[]}});for(const [id,v] of Object.entries({top:'12',bottom:'12',seam:'45',format:'jpeg'}))get(id).value=v;
 let generated=0;get('go').onclick=async()=>{generated++;return false;};
 global.document={getElementById:get,querySelectorAll:()=>[],querySelector:get};global.MutationObserver=class{observe(){}};
 const flow=ScrollshotFlow.mount({inspect:(source,signal)=>new Promise((resolve,reject)=>pending.push({source,signal,resolve,reject})),inspectError:e=>e.message,hasResult:()=>false,reset:()=>{file.files=[];}});
 const select=source=>{file.files=source?[source]:[];file.dispatchEvent(new Event('change'));};const tick=()=>new Promise(setImmediate);
 assert(get('quick-options').hidden);select({name:'slow.mp4'});assert(get('quick-generate').disabled);select({name:'new.mp4'});assert(pending[0].signal.aborted);
 pending[1].resolve({duration:6});await tick();assert.equal(get('recording-status').textContent,'录屏已就绪 · 6.0 秒');assert(!get('quick-generate').disabled);
 pending[0].reject(Error('旧文件检查失败'));await tick();assert.equal(get('recording-status').textContent,'录屏已就绪 · 6.0 秒');
 select({name:'bad.mp4'});pending[2].reject(Error('无法读取录屏'));await tick();assert(get('quick-options').hidden);await get('quick-generate').onclick();assert.equal(generated,0);
 select({name:'cleared.mp4'});flow.clear();assert(get('clear-dialog').open);get('clear-dialog').close('cancel');assert(!pending[3].signal.aborted);flow.clear();get('clear-dialog').close('clear');assert(pending[3].signal.aborted);pending[3].resolve({duration:3});await tick();assert(get('quick-options').hidden);assert.equal(get('recording-status').textContent,'');
 const same={name:'retry.mp4'},timeout=()=>Object.assign(Error('读取首帧超时'),{code:'MEDIA_TIMEOUT',stage:'first-frame'});
 select(same);pending[4].reject(timeout());await tick();assert(!get('retry-recording').hidden);
 get('retry-recording').dispatchEvent(new Event('click'));assert.equal(pending[5].source,same);assert(get('retry-recording').hidden);
 pending[5].reject(timeout());await tick();
 file.dispatchEvent(new Event('click'));assert.equal(file.files.length,0,'failed selection is cleared before the file picker reopens');
 select(same);pending[6].resolve({duration:4});await tick();
 assert(!get('quick-generate').disabled);assert(get('retry-recording').hidden);
 file.dispatchEvent(new Event('click'));file.dispatchEvent(new Event('cancel'));assert.equal(file.files[0],same,'cancelling the picker keeps a valid file');assert.equal(pending.length,7);
 console.log('PASS file replacement, abort/clear, stale responses, same-file retry/reselection and cancellation');
})().catch(error=>{console.error(error);process.exitCode=1});
