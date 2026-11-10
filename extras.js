(function(root){
function drawWatermark(ctx,width,height,options){
const text=String(options.text||'').trim().slice(0,80);if(!options.enabled||!text)return false;
const size=Math.max(10,Math.min(72,Number(options.size)||34))*width/750,margin=Math.max(10,width*.035);
ctx.save();ctx.globalAlpha=Math.max(.05,Math.min(.8,(Number(options.opacity)||50)/100));ctx.fillStyle=/^#[0-9a-f]{6}$/i.test(options.color)?options.color:'#1d3437';ctx.font=`500 ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;ctx.textBaseline='middle';
let measured=ctx.measureText(text).width,maxWidth=Math.max(1,width-margin*2);if(measured>maxWidth){ctx.font=`500 ${size*maxWidth/measured}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;measured=maxWidth}
if(options.position==='tile'){ctx.textAlign='center';const stepX=Math.max(width*.42,measured+margin*2),stepY=Math.max(width*.25,size*6);let row=0;for(let y=stepY/2;y<height;y+=stepY,row++){for(let x=stepX/2-(row%2)*stepX/2;x<width+stepX/2;x+=stepX){ctx.save();ctx.translate(x,y);ctx.rotate(-Math.PI/8);ctx.fillText(text,0,0,maxWidth);ctx.restore()}}}
else{const p=options.position||'bottom-right';let x=p.includes('left')?margin:width-margin,y=p.includes('top')?margin+size/2:height-margin-size/2;ctx.textAlign=p.includes('left')?'left':'right';if(p==='center'){x=width/2;y=height/2;ctx.textAlign='center'}ctx.fillText(text,x,Math.max(size/2,Math.min(height-size/2,y)),maxWidth)}
ctx.restore();return true;
}
function dateText(date=new Date()){const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`}
function drawPrivacy(ctx,width,height,rects){ctx.save();ctx.globalAlpha=1;for(const r of rects){ctx.fillStyle=/^#[0-9a-f]{6}$/i.test(r.color)?r.color:'#000000';const x=Math.max(0,Math.floor(r.x*width)),y=Math.max(0,Math.floor(r.y*height)),right=Math.min(width,Math.ceil((r.x+r.w)*width)),bottom=Math.min(height,Math.ceil((r.y+r.h)*height));if(right>x&&bottom>y)ctx.fillRect(x,y,right-x,bottom-y)}ctx.restore()}
function composeEdits(ctx,width,height,options,rects){drawPrivacy(ctx,width,height,rects);drawWatermark(ctx,width,height,options)}
function bindWatermark(onExport){
const get=id=>document.getElementById(id),fields=get('wm-fields'),enabled=get('wm-enabled'),message=get('wm-status'),share=get('share'),layer=get('privacy-layer'),clearMasks=get('privacy-clear'),mode=get('draw-mode'),textInput=get('wm-text'),img=get('result'),retry=get('wm-apply');
let base=null,baseURL=null,generating=false,encoding=false,dirty=false,timer=null,revision=0,drawing=false,rects=[],selected=-1,gesture=null,synced=true,defaultText=dateText(),wmKey='',controlsFrame=0,maskId=0,maskColor='#000000';
const viewport=get('editor-viewport'),shell=viewport.parentElement,remove=get('privacy-delete'),maskNodes=new Map(),blockedTaps=new WeakSet();
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function visibleBounds(){const v=viewport.getBoundingClientRect(),left=v.left+viewport.clientLeft,top=v.top+viewport.clientTop;return {left,top,right:left+viewport.clientWidth,bottom:top+viewport.clientHeight}}
function positionDelete(){
 controlsFrame=0;
 const el=layer.querySelector(`.privacy-rect[data-rect="${selected}"]`);
 if(!base||!drawing||!el||gesture||generating){remove.hidden=true;return}
 const r=el.getBoundingClientRect(),v=visibleBounds();
 const left=Math.max(r.left,v.left),right=Math.min(r.right,v.right),top=Math.max(r.top,v.top),bottom=Math.min(r.bottom,v.bottom);
 const width=44,height=44,gap=4;
 if(left>=right||top>=bottom||v.right-v.left<width+2*gap||v.bottom-v.top<height+2*gap){remove.hidden=true;return}
 const above=r.top-v.top,below=v.bottom-r.bottom;
 const side=above>=height+2*gap?'above':below>=height+2*gap?'below':above>=below?'above':'below';
 const x=clamp((left+right-width)/2,v.left+gap,v.right-width-gap);
 const y=clamp(side==='above'?r.top-height-gap:r.bottom+gap,v.top+gap,v.bottom-height-gap);
 const origin=shell.getBoundingClientRect();
 remove.style.left=`${x-origin.left-shell.clientLeft}px`;remove.style.top=`${y-origin.top-shell.clientTop}px`;
 remove.dataset.side=side;remove.setAttribute('aria-label',`移除第 ${selected+1} 处遮盖`);remove.hidden=false;
}
function scheduleDelete(){if(!controlsFrame)controlsFrame=requestAnimationFrame(positionDelete)}
viewport.addEventListener('scroll',scheduleDelete,{passive:true});
if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(scheduleDelete);observer.observe(viewport);observer.observe(layer)}else window.addEventListener('resize',scheduleDelete);
const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='watermark-preview';svg.setAttribute('aria-hidden','true');layer.parentElement.appendChild(svg);
textInput.value=defaultText;for(const name of ['focus','click'])textInput.addEventListener(name,()=>textInput.select());
const options=()=>({enabled:enabled.checked,text:textInput.value,position:get('wm-position').value,size:get('wm-size').value,opacity:get('wm-opacity').value,color:get('wm-color').value});
function state(){fields.disabled=generating||!enabled.checked;clearMasks.disabled=generating||!base||!rects.length||!!gesture;enabled.disabled=generating;mode.disabled=generating;share.disabled=!base||generating||dirty||encoding||!!timer||!!gesture;retry.disabled=generating||encoding;remove.disabled=generating||!!gesture;if(remove.disabled)remove.hidden=true;scheduleDelete();}
function setDrawing(value){drawing=value;if(!value)selected=-1;mode.setAttribute('aria-pressed',String(value));layer.classList.toggle('drawing',value);layer.style.touchAction=value?'none':'auto';paint();state();}
function makeMask(id){
 const el=document.createElement('div'),picker=document.createElement('input');
 el.className='privacy-rect';
 // Make the actual color control the hit target. Some iOS Safari versions
 // return from showPicker() without opening a color panel.
 picker.type='color';picker.className='mask-color-hit';
 picker.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')blockedTaps.delete(picker)});
 picker.addEventListener('click',e=>{
  const index=rects.findIndex(r=>r.id===id);
  if(!base||!drawing||generating||gesture||index<0||blockedTaps.has(picker)){e.preventDefault();return}
  selected=index;maskColor=rects[index].color;paint();
  // Leave the trusted click's default action intact.
 });
 for(const event of ['input','change'])picker.addEventListener(event,()=>{
  const mask=rects.find(r=>r.id===id);
  if(!base||generating||!mask||mask.color===picker.value)return;
  mask.color=picker.value;if(rects[selected]===mask)maskColor=mask.color;changed();
 });
 const handles=['nw','ne','sw','se'].map(corner=>{
  const handle=document.createElement('span');
  handle.className='resize-handle '+corner;handle.dataset.handle=corner;el.appendChild(handle);return handle;
 });
 el.prepend(picker);layer.appendChild(el);return {el,picker,handles};
}
function paint(){
 const liveIds=new Set(rects.map(r=>r.id));
 for(const [id,node] of maskNodes)if(!liveIds.has(id)){node.el.remove();maskNodes.delete(id)}
 rects.forEach((r,i)=>{
  if(!maskNodes.has(r.id))maskNodes.set(r.id,makeMask(r.id));
  const {el,picker,handles}=maskNodes.get(r.id),active=drawing&&i===selected;
  el.dataset.rect=String(i);el.classList.toggle('selected',active);
  el.style.cssText=`left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%;background:${synced?'transparent':r.color}`;
  picker.setAttribute('aria-label',`更改第 ${i+1} 处遮盖的颜色`);
  if(picker.value!==r.color)picker.value=r.color;
  picker.hidden=!drawing;picker.disabled=!drawing||generating;
  for(const handle of handles)handle.hidden=!active;
 });
 if(!drawing||selected<0)remove.hidden=true;scheduleDelete();
}
function watermarkPreview(){const o=options(),w=img.naturalWidth||750,h=img.naturalHeight||1000;const key=JSON.stringify([o,w,h,synced]);if(key===wmKey)return;wmKey=key;svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.hidden=synced||!o.enabled||!o.text.trim();if(svg.hidden)return;const originalSize=Math.max(10,Math.min(72,+o.size||34))*w/750;let font=originalSize,margin=Math.max(10,w*.035),maxWidth=w-margin*2,text=o.text.trim().slice(0,80);const ctx=document.createElement('canvas').getContext('2d');ctx.font=`500 ${font}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;let measured=ctx.measureText(text).width;if(measured>maxWidth){font*=maxWidth/measured;measured=maxWidth}function put(x,y,anchor,rotate){const t=document.createElementNS(svg.namespaceURI,'text');t.textContent=text;t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('text-anchor',anchor);t.setAttribute('dominant-baseline','central');t.setAttribute('fill',o.color);t.setAttribute('opacity',Math.max(.05,Math.min(.8,+o.opacity/100)));t.setAttribute('font-size',font);t.setAttribute('font-weight','500');t.setAttribute('font-family','-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif');if(rotate)t.setAttribute('transform',`rotate(-22.5 ${x} ${y})`);svg.appendChild(t)}
if(o.position==='tile'){const dx=Math.max(w*.42,measured+margin*2),dy=Math.max(w*.25,originalSize*6);let row=0;for(let y=dy/2;y<h;y+=dy,row++)for(let x=dx/2-(row%2)*dx/2;x<w+dx/2;x+=dx)put(x,y,'middle',true)}else{const p=o.position;let x=p.includes('left')?margin:w-margin,y=p.includes('top')?margin+originalSize/2:h-margin-originalSize/2,anchor=p.includes('left')?'start':'end';if(p==='center'){x=w/2;y=h/2;anchor='middle'}put(x,Math.max(originalSize/2,Math.min(h-originalSize/2,y)),anchor,false)}}
function live(){synced=false;if(baseURL&&img.src!==baseURL)img.src=baseURL;paint();watermarkPreview();}
function changed(queue=true){if(!base)return;revision++;dirty=true;retry.hidden=true;live();message.textContent='实时预览已更新，正在准备可保存图片…';clearTimeout(timer);timer=null;if(queue&&!gesture)timer=setTimeout(()=>{timer=null;prepare()},220);state()}
async function prepare(){if(!base||generating||gesture)return;if(encoding)return;const source=base,rev=revision,o=options(),masks=rects.map(r=>({...r}));if(o.enabled&&!o.text.trim()){message.textContent='请输入水印文字，或关闭文字水印。';dirty=true;state();return}encoding=true;state();let url,canvas;
try{let blob=source;if(o.enabled||masks.length){url=URL.createObjectURL(source);let image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('无法读取图片。'));image.src=url});canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');if(!ctx)throw Error('内存不足，请关闭其他页面后重试。');ctx.drawImage(image,0,0);composeEdits(ctx,canvas.width,canvas.height,o,masks);blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片编码失败。')),source.type,.94))}
if(rev===revision&&source===base&&!gesture){onExport(blob);dirty=false;const expected=img.src;const finish=()=>{if(rev===revision&&img.src===expected&&!dirty){synced=true;paint();watermarkPreview()}};if(img.complete&&img.naturalWidth)finish();else img.addEventListener('load',finish,{once:true});message.textContent='预览与保存图片已同步，可直接保存。'}
}catch(e){if(rev===revision){dirty=true;message.textContent=e.message+' 可点击重试。';retry.hidden=false}}finally{if(url)URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0}encoding=false;if(rev!==revision&&base&&!gesture&&!generating){clearTimeout(timer);timer=setTimeout(()=>{timer=null;prepare()},0)}state()}}
for(const event of ['input','change'])get('watermark-panel').addEventListener(event,()=>changed());
retry.addEventListener('click',()=>{retry.hidden=true;changed()});
mode.addEventListener('click',()=>{if(generating)return;cancelGesture();setDrawing(!drawing)});
remove.addEventListener('click',()=>{if(!drawing||generating||gesture||!rects[selected])return;rects.splice(selected,1);selected=-1;changed();viewport.focus({preventScroll:true})});
clearMasks.addEventListener('click',()=>{if(clearMasks.disabled)return;rects=[];selected=-1;changed();mode.focus({preventScroll:true})});
function point(e){const b=layer.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))}}
layer.addEventListener('pointerdown',e=>{
 if(!drawing||generating||!base||(e.pointerType==='mouse'&&e.button!==0))return;
 const picker=e.target.matches('.mask-color-hit')?e.target:null;
 if(gesture){if(picker)blockedTaps.add(picker);e.preventDefault();return}
 if(picker)blockedTaps.delete(picker);else e.preventDefault();
 const p=point(e),target=e.target.closest('[data-rect]'),index=target?+target.dataset.rect:-1,corner=e.target.dataset.handle;
 const previousSelected=selected;selected=index;const kind=target?(corner?'resize':'move'):'new';
 if(kind==='new'){selected=rects.length;rects.push({id:++maskId,x:p.x,y:p.y,w:0,h:0,color:maskColor})}else maskColor=rects[index].color;
 gesture={kind,start:p,startX:e.clientX,startY:e.clientY,pointerId:e.pointerId,moved:false,original:{...rects[selected]},index:selected,previousSelected,corner,picker};
 // A tap must end on the same native input, including with pointer capture.
 (picker||layer).setPointerCapture(e.pointerId);
 if(kind==='move'){paint();state()}else changed(false);
});
function update(e){if(!gesture||e.pointerId!==gesture.pointerId)return;const p=point(e),g=gesture,r={...g.original};g.moved=g.moved||Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>6;if(g.kind==='move'&&!g.moved)return;if(g.kind==='move'){r.x=Math.max(0,Math.min(1-r.w,r.x+p.x-g.start.x));r.y=Math.max(0,Math.min(1-r.h,r.y+p.y-g.start.y))}else{let left=g.kind==='new'?g.start.x:r.x,right=g.kind==='new'?p.x:r.x+r.w,top=g.kind==='new'?g.start.y:r.y,bottom=g.kind==='new'?p.y:r.y+r.h;if(g.kind==='resize'){if(g.corner.includes('w'))left=p.x;else right=p.x;if(g.corner.includes('n'))top=p.y;else bottom=p.y}r.x=Math.min(left,right);r.y=Math.min(top,bottom);r.w=Math.abs(right-left);r.h=Math.abs(bottom-top)}rects[g.index]=r;changed(false)}
layer.addEventListener('pointermove',update);
function cancelGesture(){
 if(!gesture)return;
 const g=gesture;gesture=null;
 if(g.picker)blockedTaps.add(g.picker);
 if(g.kind==='new')rects.splice(g.index,1);else rects[g.index]=g.original;
 selected=Math.min(g.previousSelected,rects.length-1);
 if(rects[selected])maskColor=rects[selected].color;
 if(g.kind!=='move'||g.moved||dirty)changed();else{paint();state()}
}
function finish(e,cancel){if(!gesture||e.pointerId!==gesture.pointerId)return;if(cancel){cancelGesture();return}const g=gesture;update(e);const r=rects[g.index],b=layer.getBoundingClientRect();if(r.w*b.width<3||r.h*b.height<3){if(g.kind==='new')rects.splice(g.index,1);else rects[g.index]=g.original}gesture=null;if(selected>=rects.length)selected=rects.length-1;if(g.picker&&g.moved)blockedTaps.add(g.picker);if(g.kind==='move'&&!g.moved){state();if(dirty&&!timer&&!encoding)changed()}else changed()}
layer.addEventListener('pointerup',e=>finish(e,false));for(const name of ['pointercancel','lostpointercapture'])layer.addEventListener(name,e=>finish(e,true));
img.addEventListener('contextmenu',e=>{if(dirty||encoding)e.preventDefault()});img.addEventListener('load',()=>{if(!synced)watermarkPreview()});
function clearState(){revision++;clearTimeout(timer);timer=null;dirty=false;rects=[];selected=-1;gesture=null;synced=true;setDrawing(false);retry.hidden=true;if(baseURL)URL.revokeObjectURL(baseURL);baseURL=null;}
state();retry.hidden=true;return {setBase(blob){clearState();base=blob;baseURL=URL.createObjectURL(blob);if(!textInput.value||textInput.value===defaultText){defaultText=dateText();textInput.value=defaultText}enabled.checked=false;watermarkPreview();message.textContent='编辑会实时预览并自动同步到保存图片。';state()},reset(){clearState();base=null;enabled.checked=false;defaultText=dateText();maskColor='#000000';for(const [id,value]of Object.entries({'wm-text':defaultText,'wm-position':'bottom-right','wm-size':'34','wm-opacity':'50','wm-color':'#1d3437'}))get(id).value=value;watermarkPreview();message.textContent='编辑会实时预览并自动同步到保存图片。';state()},cancelGesture,pauseDrawing(){cancelGesture();setDrawing(false)},setGenerating(v){generating=v;paint();state()}};
}
root.ScrollshotExtras={drawWatermark,drawPrivacy,composeEdits,dateText,bindWatermark};
})(typeof globalThis==='object'?globalThis:this);


