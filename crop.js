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
function mount(){
const get=id=>document.getElementById(id),file=get('file'),stage=get('crop-stage'),video=get('crop-video'),preview=get('crop-preview'),seek=get('crop-frame'),notice=get('crop-preview-status'),fine=get('crop-precision'),rangeText=get('crop-retained'),frameText=get('crop-frame-time');
const trimStartBtn=get('trim-set-start'),trimEndBtn=get('trim-set-end'),trimResetBtn=get('trim-reset'),trimSummary=get('trim-summary');
const input=Object.fromEntries(Object.keys(DEFAULTS).map(id=>[id,get(id)]));
const handles={top:get('crop-top-handle'),bottom:get('crop-bottom-handle')};
let active=false,suspended=false,clip=null,url=null,position=null,drag=null,seekTimer=0,duration=0,trimStart=0,trimEnd=0,pendingSeek=null,seekInFlightAt=0,trimNote='';
const values=()=>Object.fromEntries(Object.entries(input).map(([id,el])=>[id,el.valueAsNumber]));
const readable=value=>Number(value.toFixed(1));
function paintTrim(){
 if(!trimSummary)return;
 if(!duration){trimSummary.textContent='';return;}
 const s=clamp(trimStart,0,duration),e=clamp(trimEnd||duration,s,duration),span=Math.max(0,e-s);
 const isFull=s<=0.05&&e>=duration-0.05;
 const baseText=isFull?`保留全部时长（${duration.toFixed(1)} 秒）`:`已截取片段：${s.toFixed(1)}s – ${e.toFixed(1)}s（共 ${span.toFixed(1)} 秒）`;
 trimSummary.textContent=trimNote?`${baseText} · ${trimNote}`:baseText;
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
trimStartBtn?.addEventListener('click',()=>{
 if(!duration)return;
 const minSpan=Math.min(0.5,duration*0.5),raw=Number(seek.value),current=clamp(Number.isFinite(raw)?raw:0,0,duration);
 trimNote='';
 if(current<=(trimEnd||duration)-minSpan){
  trimStart=current;
 }else if(duration-current>=minSpan){
  trimStart=current;trimEnd=duration;trimNote='起点晚于原终点，已重置终点至结尾';
 }else{
  trimStart=Math.max(0,duration-minSpan);trimEnd=duration;trimNote=`至少保留 ${minSpan.toFixed(1)} 秒`;
 }
 notifyTrim();
});
trimEndBtn?.addEventListener('click',()=>{
 if(!duration)return;
 const minSpan=Math.min(0.5,duration*0.5),raw=Number(seek.value),current=clamp(Number.isFinite(raw)?raw:duration,0,duration);
 trimNote='';
 if(current>=trimStart+minSpan){
  trimEnd=current;
 }else if(current>=minSpan){
  trimStart=0;trimEnd=current;trimNote='终点早于原起点，已重置起点为 0.0s';
 }else{
  trimStart=0;trimEnd=Math.min(duration,minSpan);trimNote=`至少保留 ${minSpan.toFixed(1)} 秒`;
 }
 notifyTrim();
});
trimResetBtn?.addEventListener('click',()=>{if(!duration)return;trimStart=0;trimEnd=duration;trimNote='';notifyTrim();});
function flushSeek(exact=false){
 if(!url||video.readyState<1||pendingSeek===null)return;
 if(!exact&&video.seeking&&Date.now()-seekInFlightAt<450)return;
 const target=clamp(pendingSeek,0,Math.max(0,(Number.isFinite(video.duration)?video.duration:duration)-0.001));
 pendingSeek=null;
 seekInFlightAt=Date.now();
 try{video.currentTime=target;}catch(_){}
}
video.addEventListener('seeked',()=>{seekInFlightAt=0;if(pendingSeek!==null)flushSeek(false);});
function scheduleSeek(exact=false){
 if(seekTimer){clearTimeout(seekTimer);seekTimer=0;}
 if(exact){flushSeek(true);return;}
 if(!video.seeking||Date.now()-seekInFlightAt>=450){
  flushSeek(false);
 }else{
  seekTimer=setTimeout(()=>{seekTimer=0;flushSeek(false);},90);
 }
}
function detach(keep=true){
 drag=null;pendingSeek=null;seekInFlightAt=0;if(seekTimer){clearTimeout(seekTimer);seekTimer=0;}
 if(keep&&url&&video.readyState>=1&&Number.isFinite(video.currentTime))position=video.currentTime;
 video.onloadedmetadata=video.onloadeddata=video.onerror=null;
 if(url){video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);url=null;}
 preview.hidden=true;
}
function updateFrame(){frameText.textContent=`${Number(seek.value).toFixed(1)} / ${video.duration.toFixed(1)} 秒`;}
function attach(){
 const selected=file.files[0]||null;
 if(selected!==clip){detach(false);clip=selected;position=null;duration=0;trimStart=0;trimEnd=0;trimNote='';paintTrim();}
 if(!active||suspended||!clip||!get('capture-settings').open){detach();return;}
 if(url)return;
 notice.hidden=false;notice.textContent='正在读取录屏预览…';
 const expected=URL.createObjectURL(clip);url=expected;
 video.onloadedmetadata=()=>{
  if(url!==expected)return;
  if(!video.videoWidth||!video.videoHeight||!Number.isFinite(video.duration)||video.duration<=0){notice.textContent='无法预览这段录屏，请返回并选择一段可正常播放的视频。';return;}
  const nextDur=video.duration;
  if(!duration||Math.abs(duration-nextDur)>0.05){duration=nextDur;trimStart=0;trimEnd=nextDur;trimNote='';}
  stage.style.setProperty('--crop-ratio',String(video.videoWidth/video.videoHeight));
  seek.max=Math.max(0,nextDur-.02);seek.value=clamp(position??Math.min(.7,nextDur*.2),0,Number(seek.max));
  pendingSeek=Number(seek.value);flushSeek(true);
  setTimeout(()=>{if(url===expected&&video.readyState<2){try{video.play()?.then(()=>{if(url===expected){video.pause();pendingSeek=Number(seek.value);flushSeek(true);}},()=>{});}catch(_){}}},260);
  updateFrame();preview.hidden=false;notice.hidden=true;paint();requestAnimationFrame(fitStage);
 };
 video.onerror=()=>{if(url!==expected)return;preview.hidden=true;notice.hidden=false;notice.textContent='无法读取录屏预览。请确认视频能在相册播放，或换一段录屏。';};
 video.src=expected;
}
seek.addEventListener('input',()=>{if(!url||video.readyState<1)return;updateFrame();pendingSeek=Number(seek.value);scheduleSeek(false);});
seek.addEventListener('change',()=>{if(!url||video.readyState<1)return;updateFrame();pendingSeek=Number(seek.value);scheduleSeek(true);});
file.addEventListener('change',attach);get('capture-settings').addEventListener('toggle',attach);
paint();
return {values,trim(){return duration?{startTime:trimStart,endTime:trimEnd||duration,duration}:{startTime:0,endTime:null,duration:0};},showError(error){get('capture-settings').open=true;fine.open=true;const fd=get('s2-fine-drawer');if(fd)fd.hidden=false;get('s2-tab-fine')?.setAttribute('aria-pressed','true');input[error.id].setAttribute('aria-invalid','true');requestAnimationFrame(()=>input[error.id].focus());},setActive(value){active=value;if(!value)suspended=false;attach();},suspend(){suspended=true;detach();},resume(){suspended=false;attach();},reset(){detach(false);clip=null;position=null;duration=0;trimStart=0;trimEnd=0;trimNote='';active=suspended=false;get('capture-settings').open=true;fine.open=true;const fd=get('s2-fine-drawer');if(fd)fd.hidden=true;get('s2-tab-fine')?.setAttribute('aria-pressed','false');syncFields();}};
}
root.ScrollshotCrop={mount,validate,geometry,limitFor};
})(typeof globalThis==='object'?globalThis:this);
