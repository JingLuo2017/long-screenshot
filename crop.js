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
const input=Object.fromEntries(Object.keys(DEFAULTS).map(id=>[id,get(id)]));
const handles={top:get('crop-top-handle'),bottom:get('crop-bottom-handle')};
let active=false,suspended=false,clip=null,url=null,position=null,drag=null,seekFrame=0;
const values=()=>Object.fromEntries(Object.entries(input).map(([id,el])=>[id,el.valueAsNumber]));
const readable=value=>Number(value.toFixed(1));
function paint(){
 const g=geometry(values());
 for(const [id,v] of [['top',g.top],['bottom',g.bottom],['seam',g.line]])stage.style.setProperty('--crop-'+id,v+'%');
 for(const id of ['top','bottom']){const handle=handles[id],n=g[id];handle.setAttribute('aria-valuenow',String(readable(n)));handle.setAttribute('aria-valuemax',String(limitFor(g[id==='top'?'bottom':'top'])));handle.setAttribute('aria-valuetext',`${id==='top'?'顶部':'底部'}排除 ${readable(n)}%`);}
 rangeText.textContent=`保留画面 ${readable(g.kept)}%`;
}
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
function detach(keep=true){
 drag=null;if(seekFrame)cancelAnimationFrame(seekFrame);seekFrame=0;
 if(keep&&url&&video.readyState>=1&&Number.isFinite(video.currentTime))position=video.currentTime;
 video.onloadedmetadata=video.onerror=null;
 if(url){video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);url=null;}
 preview.hidden=true;
}
function updateFrame(){frameText.textContent=`${Number(seek.value).toFixed(1)} / ${video.duration.toFixed(1)} 秒`;}
function attach(){
 const selected=file.files[0]||null;
 if(selected!==clip){detach(false);clip=selected;position=null;}
 if(!active||suspended||!clip||!get('capture-settings').open){detach();return;}
 if(url)return;
 notice.hidden=false;notice.textContent='正在读取录屏预览…';
 const expected=URL.createObjectURL(clip);url=expected;
 video.onloadedmetadata=()=>{
  if(url!==expected)return;
  if(!video.videoWidth||!video.videoHeight||!Number.isFinite(video.duration)||video.duration<=0){notice.textContent='无法预览这段录屏，请返回并选择一段可正常播放的视频。';return;}
  stage.style.setProperty('--crop-ratio',String(video.videoWidth/video.videoHeight));
  seek.max=Math.max(0,video.duration-.02);seek.value=clamp(position??Math.min(.7,video.duration*.2),0,Number(seek.max));video.currentTime=Number(seek.value);updateFrame();preview.hidden=false;notice.hidden=true;paint();
 };
 video.onerror=()=>{if(url!==expected)return;preview.hidden=true;notice.hidden=false;notice.textContent='无法读取录屏预览。请确认视频能在相册播放，或换一段录屏。';};
 video.src=expected;
}
seek.addEventListener('input',()=>{if(!url||video.readyState<1)return;updateFrame();if(seekFrame)cancelAnimationFrame(seekFrame);seekFrame=requestAnimationFrame(()=>{seekFrame=0;if(url&&video.readyState>=1)video.currentTime=Number(seek.value)});});
file.addEventListener('change',attach);get('capture-settings').addEventListener('toggle',attach);
paint();
return {values,showError(error){get('capture-settings').open=true;fine.open=true;input[error.id].setAttribute('aria-invalid','true');requestAnimationFrame(()=>input[error.id].focus());},setActive(value){active=value;if(!value)suspended=false;attach();},suspend(){suspended=true;detach();},resume(){suspended=false;attach();},reset(){detach(false);clip=null;position=null;active=suspended=false;get('capture-settings').open=true;fine.open=false;syncFields();}};
}
root.ScrollshotCrop={mount,validate,geometry,limitFor};
})(typeof globalThis==='object'?globalThis:this);
