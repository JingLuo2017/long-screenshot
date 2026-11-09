(function(root){
'use strict';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function zoomAnchor(scroll,anchor,oldScale,newScale){return (scroll+anchor)/oldScale*newScale-anchor}
function mount(options={}){
const get=id=>document.getElementById(id),viewport=get('editor-viewport'),image=get('result'),stage=get('image-stage'),layer=get('privacy-layer'),draw=get('draw-mode'),hint=get('editor-hint');
let scale=1,base=0,viewHeight=0,pointers=new Map(),pan=null,pinch=null,multitouch=false,blockMaskClick=false,activeTool=null,editing=false,returnScroll=0,focusToken=0;
const drawing=()=>layer.classList.contains('drawing');
function controls(){
 const editing=drawing();
 const help=editing?'单指框选或调整，轻点改色；双指滑动、捏合':'单指拖动查看；双指滑动、捏合';
 if(hint.textContent!==help)hint.textContent=help;
 viewport.classList.toggle('mask-mode',editing);
}
function cancel(){
 const ids=[...pointers.keys()];pointers.clear();pan=pinch=null;multitouch=false;
 for(const id of ids)if(viewport.hasPointerCapture?.(id))viewport.releasePointerCapture(id);
}
function resize(){if(image.naturalWidth&&image.naturalHeight){image.width=image.naturalWidth;image.height=image.naturalHeight;stage.style.aspectRatio=image.naturalWidth+'/'+image.naturalHeight}const next=viewport.clientWidth;if(!next)return;const x=base?(viewport.scrollLeft+base/2)/(base*scale):.5,y=base?(viewport.scrollTop+viewHeight/2)/(base*scale):0;base=next;viewHeight=viewport.clientHeight;stage.style.width=base*scale+'px';if(image.naturalWidth){viewport.scrollLeft=x*base*scale-next/2;viewport.scrollTop=Math.max(0,y*base*scale-viewport.clientHeight/2)}controls()}
function zoom(value,anchor,point){if(!base)resize();if(!base)return;const next=clamp(value,1,4),a=anchor||{x:viewport.clientWidth/2,y:viewport.clientHeight/2};const left=point?point.x*next-a.x:zoomAnchor(viewport.scrollLeft,a.x,scale,next),top=point?point.y*next-a.y:zoomAnchor(viewport.scrollTop,a.y,scale,next);scale=next;stage.style.width=base*scale+'px';viewport.scrollLeft=left;viewport.scrollTop=top}
function local(p){const r=viewport.getBoundingClientRect();return{x:p.x-r.left-viewport.clientLeft,y:p.y-r.top-viewport.clientTop}}
function startPinch(){const [a,b]=[...pointers.values()],c=local({x:(a.x+b.x)/2,y:(a.y+b.y)/2});pinch={distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),scale,point:{x:(viewport.scrollLeft+c.x)/scale,y:(viewport.scrollTop+c.y)/scale}};pan=null}
// Capture the second touch before a mask can claim it. Roll back the first
// finger's draft and give the whole gesture to the viewport until all fingers lift.
viewport.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 if(pointers.size&&(e.pointerType!=='touch'||pointers.values().next().value.type!=='touch'))return;
 if(!pointers.size){multitouch=false;blockMaskClick=false}
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
 if(pointers.size>=2||multitouch){
  const firstPair=!multitouch||pointers.size===2;
  multitouch=blockMaskClick=true;
  e.preventDefault();e.stopPropagation();
  options.onCancelMask?.();
  for(const id of pointers.keys())viewport.setPointerCapture(id);
  if(firstPair&&pointers.size>=2)startPinch();
  return;
 }
 if(drawing()&&layer.contains(e.target))return;
 viewport.setPointerCapture(e.pointerId);
 if(!drawing())pan={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
 if(e.pointerType==='mouse')e.preventDefault();
},true);
viewport.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 const previous=pointers.get(e.pointerId);
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,type:previous.type});
 if(multitouch){
  if(pointers.size<2||!pinch)return;
  e.preventDefault();
  const [a,b]=[...pointers.values()],center=local({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  zoom(pinch.scale*Math.hypot(b.x-a.x,b.y-a.y)/pinch.distance,center,pinch.point);
 }else if(pan){
  const dx=e.clientX-pan.x,dy=e.clientY-pan.y;
  if(Math.abs(dx)+Math.abs(dy)>3){e.preventDefault();viewport.scrollLeft=pan.left-dx;viewport.scrollTop=pan.top-dy}
 }
});
function end(e){
 if(e.type==='lostpointercapture'&&e.target!==viewport&&viewport.hasPointerCapture?.(e.pointerId))return;
 if(!pointers.delete(e.pointerId))return;
 pan=pinch=null;
 if(pointers.size>=2)startPinch();
 if(!pointers.size)multitouch=false;
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,end,true);
viewport.addEventListener('keydown',()=>{blockMaskClick=false},true);
viewport.addEventListener('click',e=>{
 if(blockMaskClick&&e.target.matches('.mask-color-hit')){e.preventDefault();e.stopPropagation()}
},true);
viewport.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();zoom(scale*Math.exp(-e.deltaY*.01),local({x:e.clientX,y:e.clientY}))}},{passive:false});
function tool(id){activeTool=activeTool===id?null:id;document.querySelectorAll('[data-tool]').forEach(button=>{const open=button.dataset.tool===activeTool;button.setAttribute('aria-expanded',String(open));get(button.dataset.tool).hidden=!open});if(activeTool==='watermark-panel')scheduleWatermark()}
function focusWatermark(){focusToken=0;if(!editing||!get('wm-enabled').checked||activeTool!=='watermark-panel')return;const position=get('wm-position').value;if(position==='tile')return;const width=stage.getBoundingClientRect().width,height=stage.getBoundingClientRect().height;if(!width||!height)return;viewport.scrollLeft=position==='center'?(width-viewport.clientWidth)/2:position.includes('left')?0:width-viewport.clientWidth;viewport.scrollTop=position==='center'?(height-viewport.clientHeight)/2:position.includes('top')?0:height-viewport.clientHeight}
function scheduleWatermark(){if(focusToken)cancelAnimationFrame(focusToken);focusToken=requestAnimationFrame(focusWatermark)}
get('watermark-editor').addEventListener('input',e=>{if(e.target.id==='wm-enabled'||e.target.closest('#wm-fields'))scheduleWatermark()});
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>tool(button.dataset.tool)));
function visibleSize(){if(!editing)return;const vv=window.visualViewport,height=vv?.height||window.innerHeight;document.documentElement.style.setProperty('--editor-height',height+'px');document.documentElement.style.setProperty('--editor-top',(vv?.offsetTop||0)+'px');document.body.classList.toggle('compact-edit',height<500)}
window.visualViewport?.addEventListener('resize',visibleSize);window.visualViewport?.addEventListener('scroll',visibleSize);window.addEventListener('resize',visibleSize);
new MutationObserver(()=>{cancel();controls()}).observe(layer,{attributes:true,attributeFilter:['class']});
if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(viewport);else window.addEventListener('resize',resize);
image.addEventListener('load',resize);controls();return{setEditing(value){if(value===editing)return;editing=value;if(value)returnScroll=window.scrollY;document.querySelectorAll('.masthead,.hero,.flow-steps,#step-announcement,#flow-busy,#panel-1,#panel-2,.help-drawer,.footer').forEach(el=>el.inert=value);document.body.classList.toggle('is-editing',value);if(value){visibleSize();requestAnimationFrame(()=>{resize();draw.focus({preventScroll:true})})}else{document.body.classList.remove('compact-edit');document.documentElement.style.removeProperty('--editor-height');document.documentElement.style.removeProperty('--editor-top');window.scrollTo(0,returnScroll)}},reset(){cancel();if(activeTool)tool(activeTool);scale=1;base=0;viewport.scrollTop=viewport.scrollLeft=0;resize();viewport.scrollTop=viewport.scrollLeft=0;controls()},getScale:()=>scale};
}
root.ScrollshotViewer={mount,clamp,zoomAnchor};
})(typeof globalThis==='object'?globalThis:this);

