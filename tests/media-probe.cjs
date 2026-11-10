'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=()=>new Promise(setImmediate);
function setup(script='generation.js'){
 let now=0,id=0,created=0;
 const timers=new Map(),videos=[],active=new Set(),revoked=[];
 const document=new EventTarget();
 document.hidden=false;
 document.body={appendChild:video=>{active.add(video);assert.equal(active.size,1,'only one decoder active')}};
 class Video extends EventTarget{
  constructor(){super();this.style={};this.readyState=0;this.duration=6;this.videoWidth=720;this.videoHeight=1280;this.error=null;this.seeks=[];this.paused=true;this.playCalls=0;videos.push(this)}
  setAttribute(){} removeAttribute(name){if(name==='src')this.src=''}
  remove(){active.delete(this)}
  pause(){this.paused=true}
  play(){this.playCalls++;return Promise.reject(Error('autoplay unavailable'))}
  load(){}
  set currentTime(time){this.seeks.push(time);this.time=time}
  get currentTime(){return this.time||0}
  update(state,event){this.readyState=state;if(event)this.dispatchEvent(new Event(event))}
 }
 document.createElement=tag=>{assert.equal(tag,'video');return new Video()};
 const sandbox={document,DOMException,performance:{now:()=>now},URL:{createObjectURL:()=>`blob:fixture/${++created}`,revokeObjectURL:url=>revoked.push(url)},requestAnimationFrame:()=>++id,cancelAnimationFrame(){},setTimeout(fn,delay){const key=++id;timers.set(key,{fn,at:now+delay});return key},clearTimeout:key=>timers.delete(key)};
 vm.runInNewContext(fs.readFileSync(script,'utf8'),sandbox);
 function advance(ms){
  const target=now+ms;
  for(;;){const due=[...timers].sort(([,a],[,b])=>a.at-b.at)[0];if(!due||due[1].at>target)break;now=due[1].at;timers.delete(due[0]);due[1].fn()}
  now=target;
 }
 function visible(value){document.hidden=!value;document.dispatchEvent(new Event('visibilitychange'))}
 function start(file={size:2048}){
  const abort=new AbortController(),task=sandbox.ScrollshotGeneration.inspect(file,abort.signal);
  // Attach an observer now so a deliberately stalled test never emits an unhandled rejection.
  const result=task.then(info=>({info}),error=>({error}));
  return {abort,result,video:videos.at(-1)};
 }
 return {start,advance,visible,active,revoked,videos,timers};
}
async function reproduceOld(path){
 const old=setup(path),p=old.start();
 p.video.update(1,'loadedmetadata');await flush();
 assert.deepEqual(p.video.seeks,[.08]);
 p.video.update(2,'loadeddata');
 old.advance(10001);assert.match((await p.result).error?.message,/读取画面超时/);
 console.log('REPRODUCED v1.9.2: decoder has a frame, but a missing seeked callback still times out');
}
(async()=>{
 if(process.argv[2])await reproduceOld(process.argv[2]);
 const h=setup();
 const early=h.start();early.video.update(2);h.advance(180);
 assert.equal((await early.result).info.duration,6);
 assert.equal(early.video.seeks.length,0);
 const delayed=h.start();delayed.video.update(1,'loadedmetadata');await flush();
 delayed.video.update(2,'loadeddata');
 assert.equal((await delayed.result).info.width,720);
 assert.equal(delayed.video.seeks.length,0);
 const paused=h.start();paused.video.update(1,'loadedmetadata');await flush();
 h.advance(2400);assert.equal(paused.video.playCalls,1);
 h.visible(false);h.advance(60000);await flush();assert(h.active.has(paused.video));
 h.visible(true);paused.video.update(2);h.advance(180);
 assert.equal((await paused.result).info.height,1280);
 assert.equal(paused.video.playCalls,1);
 const empty=h.start({size:0});assert.match((await empty.result).error?.message,/录屏为空/);
 const tooLong=h.start();tooLong.video.duration=90.1;tooLong.video.update(1,'loadedmetadata');assert.match((await tooLong.result).error?.message,/超过 90 秒/);
 const corrupt=h.start();corrupt.video.error={code:4};corrupt.video.dispatchEvent(new Event('error'));assert.match((await corrupt.result).error?.message,/无法读取录屏/);
 const metadata=h.start();h.advance(16001);
 assert.equal((await metadata.result).error?.stage,'metadata');
 const frame=h.start();frame.video.update(1,'loadedmetadata');await flush();h.advance(18001);
 const timeout=(await frame.result).error;assert.equal(timeout?.code,'MEDIA_TIMEOUT');assert.equal(timeout?.stage,'first-frame');
 const aborted=h.start();aborted.video.update(1,'loadedmetadata');await flush();aborted.abort.abort();
 assert(!h.active.has(aborted.video),'abort releases the decoder synchronously');
 const replacement=h.start();replacement.video.duration=.045;replacement.video.update(2,'canplay');
 assert.equal((await aborted.result).error?.name,'AbortError');assert.equal((await replacement.result).info.duration,.045);
 assert.equal(h.active.size,0);assert.equal(h.timers.size,0);assert.equal(new Set(h.revoked).size,h.videos.length);assert.equal(h.revoked.length,h.videos.length);
 console.log('PASS first frame without seek/paint, polling, background time, file limits, stage errors and decoder cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
