(function(root){
'use strict';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function zoomAnchor(scroll,anchor,oldScale,newScale){return (scroll+anchor)/oldScale*newScale-anchor}
function mount(options={}){
const get=id=>document.getElementById(id),viewport=get('editor-viewport'),image=get('result'),stage=get('image-stage'),layer=get('privacy-layer'),minus=get('zoom-out'),plus=get('zoom-in'),fit=get('zoom-fit'),output=get('zoom-value'),browse=get('view-mode'),draw=get('draw-mode'),hint=get('editor-hint');
let scale=1,base=0,viewHeight=0,pointers=new Map(),pan=null,pinch=null;
const drawing=()=>layer.classList.contains('drawing');
function controls(){const editing=drawing();minus.disabled=scale<=1.001;plus.disabled=scale>=4;output.value=Math.round(scale*100)+'%';output.textContent=output.value;browse.setAttribute('aria-pressed',String(!editing));draw.setAttribute('aria-pressed',String(editing));hint.textContent=editing?'框选模式：单指绘制或调整遮盖；需要移动或缩放时，请先切换“移动查看”。':'查看模式：预览内拖动查看、双指缩放；预览外滚动页面。缩放不改变导出清晰度。';viewport.classList.toggle('mask-mode',editing)}
function cancel(){for(const id of pointers.keys())if(viewport.hasPointerCapture?.(id))viewport.releasePointerCapture(id);pointers.clear();pan=pinch=null}
function resize(){if(image.naturalWidth&&image.naturalHeight){image.width=image.naturalWidth;image.height=image.naturalHeight;stage.style.aspectRatio=image.naturalWidth+'/'+image.naturalHeight}const next=viewport.clientWidth;if(!next)return;const x=base?(viewport.scrollLeft+base/2)/(base*scale):.5,y=base?(viewport.scrollTop+viewHeight/2)/(base*scale):0;base=next;viewHeight=viewport.clientHeight;stage.style.width=base*scale+'px';if(image.naturalWidth){viewport.scrollLeft=x*base*scale-next/2;viewport.scrollTop=Math.max(0,y*base*scale-viewport.clientHeight/2)}controls()}
function zoom(value,anchor,point){if(!base)resize();if(!base)return;const next=clamp(value,1,4),a=anchor||{x:viewport.clientWidth/2,y:viewport.clientHeight/2};const left=point?point.x*next-a.x:zoomAnchor(viewport.scrollLeft,a.x,scale,next),top=point?point.y*next-a.y:zoomAnchor(viewport.scrollTop,a.y,scale,next);scale=next;stage.style.width=base*scale+'px';viewport.scrollLeft=left;viewport.scrollTop=top;controls()}
function local(p){const r=viewport.getBoundingClientRect();return{x:p.x-r.left-viewport.clientLeft,y:p.y-r.top-viewport.clientTop}}
function startPinch(){const [a,b]=[...pointers.values()],c=local({x:(a.x+b.x)/2,y:(a.y+b.y)/2});pinch={distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),scale,point:{x:(viewport.scrollLeft+c.x)/scale,y:(viewport.scrollTop+c.y)/scale}};pan=null}
viewport.addEventListener('pointerdown',e=>{if(drawing()||(e.pointerType==='mouse'&&e.button!==0))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);if(pointers.size===2)startPinch();else if(pointers.size===1)pan={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false,maskIndex:e.target.closest('[data-rect]:not([data-handle])')?.dataset.rect};if(e.pointerType==='mouse')e.preventDefault()});
viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||drawing())return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2&&pinch){e.preventDefault();const[a,b]=[...pointers.values()],center=local({x:(a.x+b.x)/2,y:(a.y+b.y)/2});zoom(pinch.scale*Math.hypot(b.x-a.x,b.y-a.y)/pinch.distance,center,pinch.point)}else if(pan){const dx=e.clientX-pan.x,dy=e.clientY-pan.y;pan.moved=pan.moved||Math.hypot(dx,dy)>6;if(Math.abs(dx)+Math.abs(dy)>3){e.preventDefault();viewport.scrollLeft=pan.left-dx;viewport.scrollTop=pan.top-dy}}});
function end(e){if(!pointers.has(e.pointerId))return;const maskIndex=e.type==='pointerup'&&pointers.size===1&&!pinch&&pan&&!pan.moved?pan.maskIndex:undefined;pointers.delete(e.pointerId);pinch=null;if(pointers.size===1){const p=[...pointers.values()][0];pan={x:p.x,y:p.y,left:viewport.scrollLeft,top:viewport.scrollTop,moved:true}}else pan=null;if(maskIndex!==undefined)layer.dispatchEvent(new CustomEvent('mask-color-request',{detail:{index:Number(maskIndex)}}))}
for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,end);
minus.addEventListener('click',()=>{cancel();zoom(scale-.25)});plus.addEventListener('click',()=>{cancel();zoom(scale+.25)});fit.addEventListener('click',()=>{cancel();zoom(1)});
browse.addEventListener('click',()=>{cancel();options.onBrowse?.();controls()});draw.addEventListener('click',()=>{cancel();options.onDraw?.();controls()});
new MutationObserver(()=>{cancel();controls()}).observe(layer,{attributes:true,attributeFilter:['class']});
if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(viewport);else window.addEventListener('resize',resize);
image.addEventListener('load',resize);controls();return{reset(){cancel();scale=1;base=0;viewport.scrollTop=viewport.scrollLeft=0;resize();viewport.scrollTop=viewport.scrollLeft=0;controls()},getScale:()=>scale};
}
root.ScrollshotViewer={mount,clamp,zoomAnchor};
})(typeof globalThis==='object'?globalThis:this);
