(function(root){
'use strict';
const LIMIT=40,MAX_TOTAL=69,DEFAULTS={top:12,bottom:12,seam:45};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const limitFor=other=>Math.min(LIMIT,MAX_TOTAL-clamp(Number.isFinite(other)?other:0,0,LIMIT));
function validate({top,bottom,seam}){
for(const [id,name,value] of [['top','顶部排除',top],['bottom','底部排除',bottom]])if(!Number.isFinite(value)||value<0||value>LIMIT)return {id,message:`${name}请输入 0–40%，或拖动画面中的边界。`};
if(top+bottom>MAX_TOTAL)return {id:'bottom',message:'顶部和底部合计最多排除 69%。请向外拖动边界，扩大保留区域。'};
if(!Number.isFinite(seam)||seam<25||seam>70)return {id:'seam',message:'参考拼接位置请输入 25–70%，也可以恢复默认的 45%。'};
return null;
}
function geometry(values){
const read=(key,min,max)=>clamp(Number.isFinite(values[key])?values[key]:DEFAULTS[key],min,max);
const top=read('top',0,LIMIT),bottom=read('bottom',0,limitFor(top)),seam=read('seam',25,70);
return {top,bottom,seam,kept:100-top-bottom,line:top+(100-top-bottom)*seam/100};
}
/* A single outstanding seek, with the latest requested time replacing queued work.
   Poll as well as listening for seeked: WebKit can omit that event after a rapid drag. */
function createFrameSeeker(video,onState){
 const EPS=0.015,TIMEOUT=5000;
 let latest=null,confirmed=null,job=null,timer=0,raf=0,frame=0,disposed=false,phase='idle';
 const visible=()=>typeof document==='undefined'||document.visibilityState!=='hidden';
 const matches=target=>!video.seeking&&video.readyState>=2&&Math.abs(video.currentTime-target)<=EPS;
 function cancelRender(){
  if(raf)cancelAnimationFrame(raf);raf=0;
  if(frame&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frame);frame=0;
 }
 function clearWork(){if(timer)clearTimeout(timer);timer=0;cancelRender();job=null;}
 function report(next,error){phase=next;onState({phase,target:latest,time:confirmed,error});}
 function arm(){if(!timer&&!disposed&&job&&visible())timer=setTimeout(()=>{timer=0;check();},100);}
 function fail(){clearWork();report('error','画面定位暂未完成，请点“重试预览”。录屏和已选片段均已保留。');}
 function finish(expected){
  if(disposed||job!==expected||!visible()||!matches(expected.target))return;
  confirmed=video.currentTime;clearWork();
  if(Math.abs(latest-confirmed)>EPS)start();
  else report('ready');
 }
 function render(expected){
  if(raf||frame)return;
  // A decoded frame must reach the presentation step before enabling trim buttons.
  // Two animation frames also cover paused WebKit videos without a frame callback.
  if(video.requestVideoFrameCallback)frame=video.requestVideoFrameCallback((_,meta)=>{
   if(disposed||job!==expected)return;
   frame=0;
   if(meta&&Math.abs(meta.mediaTime-expected.target)<0.12)finish(expected);
  });
  raf=requestAnimationFrame(()=>{raf=requestAnimationFrame(()=>{raf=0;finish(expected);});});
 }
 function check(){
  if(disposed||!job||!visible())return;
  if(matches(job.target))render(job);
  else{cancelRender();if(Date.now()-job.started>=TIMEOUT){fail();return;}}
  arm();
 }
 function start(){
  if(disposed||job||latest===null)return;
  job={target:latest,started:Date.now()};
  try{video.pause();video.currentTime=job.target;}catch(_){fail();return;}
  check();
 }
 function request(value){
  if(disposed||!Number.isFinite(value))return;
  latest=clamp(value,0,Math.max(0,video.duration-0.001));
  if(phase==='ready'&&Math.abs(latest-confirmed)<=EPS&&matches(confirmed))return;
  report('seeking');start();arm();
 }
 function visibility(){
  if(!visible()){if(timer)clearTimeout(timer);timer=0;cancelRender();}
  else if(job){job.started=Date.now();check();}
 }
 const events=['seeked','loadeddata','canplay'];
 for(const name of events)video.addEventListener(name,check);
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibility);
 return {request,current(){return phase==='ready'&&!job&&confirmed!==null&&matches(confirmed)?confirmed:null;},target(){return latest;},dispose(){disposed=true;clearWork();for(const name of events)video.removeEventListener(name,check);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility);}};
}
function mount(){
const get=id=>document.getElementById(id),file=get('file'),stage=get('crop-stage'),video=get('crop-video'),preview=get('crop-preview'),seek=get('crop-frame'),notice=get('crop-preview-status'),fine=get('crop-precision'),rangeText=get('crop-retained'),frameText=get('crop-frame-time');
const trimEndInput=get('trim-end'),trimResetBtn=get('trim-reset'),trimSummary=get('trim-summary');
const input=Object.fromEntries(Object.keys(DEFAULTS).map(id=>[id,get(id)]));
const handles={top:get('crop-top-handle'),bottom:get('crop-bottom-handle')};
const retry=get('crop-preview-retry');
let active=false,suspended=false,clip=null,url=null,position=null,drag=null,duration=0,trimStart=0,trimEnd=0,trimNote='',seeker=null,recoveryCount=0,recoveryTimer=0;
function lockTrim(locked){preview.setAttribute('aria-busy',String(locked));const unavailable=!duration||!url||suspended;seek.disabled=trimEndInput.disabled=unavailable;}
lockTrim(true);
const values=()=>Object.fromEntries(Object.entries(input).map(([id,el])=>[id,el.valueAsNumber]));
const readable=value=>Number(value.toFixed(1));
function paintTrim(){
 if(!trimSummary)return;
 if(!duration){get('trim-selected-range').textContent=get('trim-selected-duration').textContent='';seek.disabled=trimEndInput.disabled=true;return;}
 const s=clamp(trimStart,0,duration),e=clamp(trimEnd||duration,s,duration),span=Math.max(0,e-s);
 const isFull=s<=0.05&&e>=duration-0.05;
 const time=value=>{const tenths=Math.round(value*10);return `${String(Math.floor(tenths/600)).padStart(2,'0')}:${String(Math.floor(tenths/10)%60).padStart(2,'0')}.${tenths%10}`;};
 get('trim-start-time').textContent=time(s);get('trim-end-time').textContent=time(e);
 get('trim-selected-range').textContent=`已选 ${time(s)}–${time(e)}`;
 get('trim-selected-duration').textContent=`· 共 ${span.toFixed(1)} 秒`;
 for(const el of [seek,trimEndInput]){el.max=String(duration);el.disabled=!url||suspended;}
 seek.value=String(s);trimEndInput.value=String(e);
 seek.setAttribute('aria-valuetext',`起点 ${time(s)}`);trimEndInput.setAttribute('aria-valuetext',`终点 ${time(e)}`);
 const gap=Math.min(.5,duration*.5);
 seek.setAttribute('aria-valuemax',String(Math.max(0,e-gap)));trimEndInput.setAttribute('aria-valuemin',String(s+gap));
 get('trim-selection').style.left=`calc(8px + (100% - 16px) * ${s/duration})`;
 get('trim-selection').style.right=`calc(8px + (100% - 16px) * ${1-e/duration})`;
 if(trimResetBtn)trimResetBtn.disabled=isFull;
}
function notifyTrim(){
 paintTrim();
 input.top.dispatchEvent(new Event('change',{bubbles:true}));
}
function paint(){
 const g=geometry(values());
 for(const [id,v] of [['top',g.top],['bottom',g.bottom],['seam',g.line]])stage.style.setProperty('--crop-'+id,v+'%');
 for(const id of ['top','bottom']){const handle=handles[id],n=g[id];handle.setAttribute('aria-valuenow',String(readable(n)));handle.setAttribute('aria-valuemax',String(limitFor(g[id==='top'?'bottom':'top'])));handle.setAttribute('aria-valuetext',`${id==='top'?'顶部':'底部'}排除 ${readable(n)}%`);}
 rangeText.textContent=`保留画面 ${readable(g.kept)}%`;
 paintTrim();
}
function fitStage(){
 const rail=stage.parentElement;
 if(!rail||preview.hidden)return;
 const rw=Math.max(0,rail.clientWidth-12),rh=Math.max(0,rail.clientHeight-12);
 if(!rw||!rh)return;
 const ratio=parseFloat(stage.style.getPropertyValue('--crop-ratio'))||0.5;
 const h=Math.min(rh,rw/ratio),w=h*ratio;
 stage.style.width=Math.floor(w)+'px';
 stage.style.height=Math.floor(h)+'px';
}
if(typeof ResizeObserver==='function'&&stage.parentElement){new ResizeObserver(fitStage).observe(stage.parentElement);}
else if(typeof window!=='undefined'){window.addEventListener('resize',fitStage);}
function setBoundary(id,value){
 const other=id==='top'?'bottom':'top',g=geometry(values());
 input[id].value=String(clamp(Math.round(value),0,limitFor(g[other])));input[id].dispatchEvent(new Event('input',{bubbles:true}));input[id].dispatchEvent(new Event('change',{bubbles:true}));
}
for(const [id,handle] of Object.entries(handles)){
 handle.addEventListener('pointerdown',e=>{if(drag||(e.pointerType==='mouse'&&e.button!==0))return;drag={id,pointer:e.pointerId,start:e.clientY,boundary:geometry(values())[id]};e.preventDefault();handle.focus({preventScroll:true});handle.setPointerCapture(e.pointerId)});
 handle.addEventListener('pointermove',e=>{if(drag?.id!==id||drag.pointer!==e.pointerId)return;const bounds=stage.getBoundingClientRect();if(bounds.height)setBoundary(id,drag.boundary+(e.clientY-drag.start)/bounds.height*100*(id==='top'?1:-1))});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(event,e=>{if(drag?.id===id&&drag.pointer===e.pointerId)drag=null});
 handle.addEventListener('keydown',e=>{let n=geometry(values())[id],step=e.shiftKey?5:1;if(e.key==='Home')n=0;else if(e.key==='End')n=LIMIT;else if(e.key==='ArrowUp')n+=id==='top'?-step:step;else if(e.key==='ArrowDown')n+=id==='top'?step:-step;else if(e.key==='ArrowLeft')n-=step;else if(e.key==='ArrowRight')n+=step;else return;e.preventDefault();setBoundary(id,n)});
}
function syncFields(){for(const el of Object.values(input))el.removeAttribute('aria-invalid');paint()}
for(const el of Object.values(input))el.addEventListener('input',syncFields);
get('crop-defaults').addEventListener('click',()=>{for(const [id,value] of Object.entries(DEFAULTS)){input[id].value=value;input[id].dispatchEvent(new Event('change',{bubbles:true}));}syncFields()});
function changeTrim(side){
 if(!duration||!url||suspended)return;
 const gap=Math.min(.5,duration*.5);
 if(side==='start')trimStart=clamp(Number(seek.value),0,(trimEnd||duration)-gap);
 else trimEnd=clamp(Number(trimEndInput.value),trimStart+gap,duration);
 trimNote='';notifyTrim();
 const target=side==='start'?trimStart:trimEnd;
 position=clamp(target,0,Math.max(0,duration-.001));seeker?.request(position);
}
for(const event of ['input','change']){
 seek.addEventListener(event,()=>changeTrim('start'));
 trimEndInput.addEventListener(event,()=>changeTrim('end'));
}
trimResetBtn?.addEventListener('click',()=>{if(!duration)return;trimStart=0;trimEnd=duration;trimNote='';notifyTrim();position=0;seeker?.request(0);});
function detach(keep=true){
 drag=null;if(recoveryTimer)clearTimeout(recoveryTimer);recoveryTimer=0;
 if(keep&&url)position=seeker?.target()??position;
 seeker?.dispose();seeker=null;lockTrim(true);if(retry)retry.hidden=true;
 video.onloadedmetadata=video.onloadeddata=video.onerror=null;
 if(url){video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);url=null;}
 preview.hidden=true;
}
function attach(){
 const selected=file.files[0]||null;
 if(selected!==clip){detach(false);clip=selected;position=null;duration=0;trimStart=0;trimEnd=0;trimNote='';recoveryCount=0;paintTrim();}
 if(!active||suspended||!clip||!get('capture-settings').open){detach();return;}
 if(url)return;
 notice.hidden=false;notice.textContent='正在读取录屏预览…';lockTrim(true);
 const expected=URL.createObjectURL(clip);url=expected;
 video.onloadedmetadata=()=>{
  if(url!==expected)return;
  if(!video.videoWidth||!video.videoHeight||!Number.isFinite(video.duration)||video.duration<=0){notice.textContent='无法预览这段录屏，请返回并选择一段可正常播放的视频。';return;}
  const nextDur=video.duration;
  if(!duration||Math.abs(duration-nextDur)>0.05){duration=nextDur;trimStart=0;trimEnd=nextDur;trimNote='';}
  stage.style.setProperty('--crop-ratio',String(video.videoWidth/video.videoHeight));
  seek.max=trimEndInput.max=String(nextDur);
  seeker?.dispose();
  seeker=createFrameSeeker(video,state=>{
   if(url!==expected)return;
   const waiting=state.phase!=='ready';lockTrim(waiting);
   frameText.dataset.state=state.phase;
   frameText.textContent=state.phase==='ready'?`${state.time.toFixed(1)} / ${duration.toFixed(1)} 秒`:state.phase==='error'?'定位未完成':`正在定位 ${state.target.toFixed(1)} 秒…`;
   if(state.phase==='ready'){position=state.time;recoveryCount=0;notice.hidden=true;if(retry)retry.hidden=true;}
   if(state.phase==='error'){
    if(recoveryCount<1){
     recoveryCount++;position=state.target;
     notice.hidden=false;notice.textContent='正在重新读取预览，已保留录屏与片段设置…';
     recoveryTimer=setTimeout(()=>{recoveryTimer=0;if(url!==expected)return;detach();attach();},0);
    }else{notice.hidden=false;notice.textContent=state.error;if(retry)retry.hidden=false;}
   }
  });
  preview.hidden=false;notice.hidden=true;paint();requestAnimationFrame(fitStage);
  seeker.request(clamp(position??trimStart,0,Math.max(0,nextDur-.001)));
 };
 video.onerror=()=>{if(url!==expected)return;seeker?.dispose();seeker=null;lockTrim(true);preview.hidden=true;notice.hidden=false;notice.textContent='无法读取录屏预览。请确认视频能在相册播放，或换一段录屏。';if(retry)retry.hidden=false;};
 video.src=expected;
}
retry?.addEventListener('click',()=>{recoveryCount=0;detach();attach();});
file.addEventListener('change',attach);get('capture-settings').addEventListener('toggle',attach);
paint();
return {values,trim(){return duration?{startTime:trimStart,endTime:trimEnd||duration,duration}:{startTime:0,endTime:null,duration:0};},showError(error){get('capture-settings').open=true;fine.open=true;const fd=get('s2-fine-drawer');if(fd)fd.hidden=false;get('s2-tab-fine')?.setAttribute('aria-pressed','true');input[error.id].setAttribute('aria-invalid','true');requestAnimationFrame(()=>input[error.id].focus());},setActive(value){active=value;if(!value)suspended=false;attach();},suspend(){suspended=true;detach();},resume(){suspended=false;attach();},reset(){detach(false);clip=null;position=null;duration=0;trimStart=0;trimEnd=0;trimNote='';active=suspended=false;get('capture-settings').open=true;fine.open=true;const fd=get('s2-fine-drawer');if(fd)fd.hidden=true;get('s2-tab-fine')?.setAttribute('aria-pressed','false');syncFields();}};
}
root.ScrollshotCrop={mount,validate,geometry,limitFor,createFrameSeeker};
})(typeof globalThis==='object'?globalThis:this);
