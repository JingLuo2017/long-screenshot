const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function harness(){
 let clock=1000,nextId=0,blob=0;const tasks=new Map(),els={},states=[],assignments=[];
 const later=(fn,ms)=>{const id=++nextId;tasks.set(id,{fn,at:clock+ms});return id;};
 class Element extends EventTarget{
  constructor(){super();this.value='';this.valueAsNumber=0;this.hidden=false;this.open=true;this.disabled=false;this.dataset={};this.attributes={};this.clientWidth=400;this.clientHeight=550;this.style={setProperty(){},getPropertyValue(){return '.5'}};}
  setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}focus(){}getBoundingClientRect(){return {height:500};}
 }
 const get=id=>els[id]||(els[id]=new Element());
 class Video extends Element{
  constructor(){super();this.duration=20;this.videoWidth=720;this.videoHeight=1280;this.readyState=2;this.seeking=false;this.time=0;this.throws=false;}
  set currentTime(t){if(this.throws)throw Error('decoder busy');this.time=t;this.seeking=true;assignments.push(t);}
  get currentTime(){return this.time;}pause(){}load(){this.seeking=false;}
 }
 const video=els['crop-video']=new Video(),doc=new EventTarget();doc.getElementById=get;doc.visibilityState='visible';
 for(const[k,v]of Object.entries({top:12,bottom:12,seam:45}))Object.assign(get(k),{value:String(v),valueAsNumber:v});
 get('file').files=[{name:'slow.mp4'}];
 const ctx={document:doc,Event,Date:{now:()=>clock},URL:{createObjectURL:()=>`blob:${++blob}`,revokeObjectURL(){}},ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>later(fn,16),cancelAnimationFrame:id=>tasks.delete(id),setTimeout:later,clearTimeout:id=>tasks.delete(id)};
 vm.runInNewContext(fs.readFileSync('crop.js','utf8'),ctx);
 const advance=ms=>{const end=clock+ms;let count=0;for(;;){const next=[...tasks.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;assert(++count<10000,'unbounded timer loop');clock=next[1].at;tasks.delete(next[0]);next[1].fn();}clock=end;};
 const complete=(event=true)=>{video.seeking=false;video.readyState=2;if(event)video.dispatchEvent(new Event('seeked'));};
 const seeker=()=>ctx.ScrollshotCrop.createFrameSeeker(video,s=>states.push(s));
 return {ctx,video,doc,get,states,assignments,tasks,advance,complete,seeker};
}
{
 const h=harness(),s=h.seeker();s.request(2);h.advance(20);s.request(8);s.request(9);s.request(8);
 assert.deepEqual(h.assignments,[2]);assert.equal(s.current(),null);
 h.complete();h.advance(32);assert.deepEqual(h.assignments,[2,8]);assert.equal(s.current(),null);
 assert(!h.states.some(x=>x.phase==='ready'),'old frames must not enable trimming while a newer request waits');
 h.complete();h.advance(32);assert.equal(s.current(),8);assert.equal(h.states.at(-1).time,8);
 const n=h.assignments.length;s.request(8);assert.equal(h.assignments.length,n,'change after input must not restart a completed seek');s.dispose();assert.equal(h.tasks.size,0);
}
{
 const h=harness(),s=h.seeker();s.request(3);s.request(12);h.complete(false);h.advance(140);
 assert.deepEqual(h.assignments,[3,12],'polling must drain the queue even if seeked is absent');
 h.complete(false);h.advance(140);assert.equal(s.current(),12);s.dispose();
}
{
 const h=harness(),s=h.seeker();s.request(7);h.video.seeking=false;h.video.readyState=1;h.advance(300);
 assert.equal(s.current(),null,'metadata without decoded data is not a confirmed frame');
 h.video.readyState=2;h.video.dispatchEvent(new Event('loadeddata'));h.advance(31);assert.equal(s.current(),null);h.advance(1);assert.equal(s.current(),7);
 h.video.time=1;assert.equal(s.current(),null,'drift must not commit an old displayed frame');s.dispose();
}
{
 const h=harness(),s=h.seeker();s.request(1);s.request(17);h.advance(5000);
 assert.equal(h.states.at(-1).phase,'error');assert.equal(s.current(),null);assert.equal(h.tasks.size,0,'a stalled decoder must produce an actionable state instead of waiting forever');
 s.request(17);h.complete();h.advance(32);assert.equal(s.current(),17);s.dispose();
}
{
 const h=harness(),s=h.seeker();s.request(9);h.advance(4990);h.complete();h.advance(32);
 assert.equal(s.current(),9,'a decoded frame arriving near the timeout must get time to be presented');s.dispose();
}
{
 const h=harness(),s=h.seeker();s.request(6);h.advance(250);h.doc.visibilityState='hidden';h.doc.dispatchEvent(new Event('visibilitychange'));h.advance(60000);
 assert(!h.states.some(x=>x.phase==='error'),'background time must not exhaust the seek timeout');
 h.doc.visibilityState='visible';h.doc.dispatchEvent(new Event('visibilitychange'));h.complete(false);h.advance(140);assert.equal(s.current(),6);s.dispose();
}
{
 const h=harness(),s=h.seeker();h.video.throws=true;s.request(4);assert.equal(h.states.at(-1).phase,'error');h.video.throws=false;s.request(4);h.complete();s.dispose();h.advance(1000);
 assert.equal(h.states.filter(x=>x.phase==='ready').length,0,'disposed frame callbacks cannot confirm a stale source');assert.equal(h.tasks.size,0);
}
{
 const h=harness(),crop=h.ctx.ScrollshotCrop.mount();crop.setActive(true);h.video.onloadedmetadata();
 assert.equal(h.get('trim-set-start').disabled,true);h.complete();h.advance(32);assert.equal(h.get('trim-set-start').disabled,false);
 const input=t=>{h.get('crop-frame').value=String(t);h.get('crop-frame').dispatchEvent(new Event('input'));};
 input(2);input(8);h.get('crop-frame').dispatchEvent(new Event('change'));
 h.get('trim-set-start').dispatchEvent(new Event('click'));assert.equal(crop.trim().startTime,0,'pending slider digits must not be used to set a trim point');assert.match(h.get('crop-frame-time').textContent,/正在定位 8.0/);
 h.complete();h.advance(32);assert.equal(h.get('trim-set-start').disabled,true);
 h.complete();h.advance(32);assert.equal(h.get('trim-set-start').disabled,false);h.get('trim-set-start').dispatchEvent(new Event('click'));assert.equal(crop.trim().startTime,8);assert.match(h.get('crop-frame-time').textContent,/^8.0 \/ 20.0/);
 input(14);h.advance(5000);assert.match(h.get('crop-preview-status').textContent,/正在读取/);h.video.onloadedmetadata();assert.equal(crop.trim().startTime,8,'automatic preview recovery preserves trim settings');
 h.advance(5000);assert.equal(h.get('crop-preview-retry').hidden,false);assert.match(h.get('crop-preview-status').textContent,/重试预览/);
 h.get('crop-preview-retry').dispatchEvent(new Event('click'));h.video.onloadedmetadata();h.complete();h.advance(32);assert.equal(h.get('trim-set-start').disabled,false);assert.equal(crop.trim().startTime,8);
 input(10);crop.setActive(false);h.advance(6000);crop.setActive(true);h.video.onloadedmetadata();assert.equal(h.assignments.at(-1),10,'returning to settings preserves the last requested position');
 crop.reset();h.advance(6000);assert.equal(crop.trim().duration,0);assert.equal(h.get('trim-set-start').disabled,true);assert.equal(h.tasks.size,0);
}
console.log('PASS seek coalescing, missing events, decoded-frame confirmation, timeout/retry, background/resume, trimming guards and stale-source cleanup');
