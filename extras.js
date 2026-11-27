(function(root){
function drawWatermark(ctx,width,height,options){
const text=String(options.text||'').trim().slice(0,80);if(!options.enabled||!text)return false;
const size=Math.max(10,Math.min(72,Number(options.size)||34))*width/750,margin=Math.max(10,width*.035);
ctx.save();ctx.globalAlpha=Math.max(.05,Math.min(.8,(Number(options.opacity)||20)/100));ctx.fillStyle=/^#[0-9a-f]{6}$/i.test(options.color)?options.color:'#1d3437';ctx.font=`500 ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;ctx.textBaseline='middle';
let measured=ctx.measureText(text).width,maxWidth=Math.max(1,width-margin*2);if(measured>maxWidth){ctx.font=`500 ${size*maxWidth/measured}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;measured=maxWidth}
if(options.position==='tile'){ctx.textAlign='center';const stepX=Math.max(width*.42,measured+margin*2),stepY=Math.max(width*.25,size*6);let row=0;for(let y=stepY/2;y<height;y+=stepY,row++){for(let x=stepX/2-(row%2)*stepX/2;x<width+stepX/2;x+=stepX){ctx.save();ctx.translate(x,y);ctx.rotate(-Math.PI/8);ctx.fillText(text,0,0,maxWidth);ctx.restore()}}}
else{const p=options.position||'bottom-right';let x=p.includes('left')?margin:width-margin,y=p.includes('top')?margin+size/2:height-margin-size/2;ctx.textAlign=p.includes('left')?'left':'right';if(p==='center'){x=width/2;y=height/2;ctx.textAlign='center'}ctx.fillText(text,x,Math.max(size/2,Math.min(height-size/2,y)),maxWidth)}
ctx.restore();return true;
}
function dateText(date=new Date()){const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`}
// Use the same bounded pixel renderer for live masks and exported images.
// The software blur also works on iOS versions without CanvasRenderingContext2D.filter.
function blurPixels(image,radius){
 const {width:w,height:h,data}=image,tmp=new Uint8ClampedArray(data.length),span=radius*2+1;
 for(let pass=0;pass<3;pass++){
  for(let y=0;y<h;y++)for(let c=0;c<4;c++){
   let sum=0;for(let k=-radius;k<=radius;k++)sum+=data[(y*w+Math.max(0,Math.min(w-1,k)))*4+c];
   for(let x=0;x<w;x++){
    tmp[(y*w+x)*4+c]=sum/span;
    sum+=data[(y*w+Math.min(w-1,x+radius+1))*4+c]-data[(y*w+Math.max(0,x-radius))*4+c];
   }
  }
  for(let x=0;x<w;x++)for(let c=0;c<4;c++){
   let sum=0;for(let k=-radius;k<=radius;k++)sum+=tmp[(Math.max(0,Math.min(h-1,k))*w+x)*4+c];
   for(let y=0;y<h;y++){
    data[(y*w+x)*4+c]=sum/span;
    sum+=tmp[(Math.min(h-1,y+radius+1)*w+x)*4+c]-tmp[(Math.max(0,y-radius)*w+x)*4+c];
   }
  }
 }
 return image;
}
function maskTile(source,width,height,r){
 const x=Math.max(0,Math.floor(r.x*width)),y=Math.max(0,Math.floor(r.y*height));
 const bw=Math.min(width,Math.ceil((r.x+r.w)*width))-x,bh=Math.min(height,Math.ceil((r.y+r.h)*height))-y;
 if(bw<=0||bh<=0)return null;
 const tile=document.createElement('canvas');tile.width=bw;tile.height=bh;
 const out=tile.getContext('2d');if(!out)return null;
 if((r.style||'pixel')==='glass'){
  const scale=Math.min(1,250/width),radius=Math.max(3,Math.round(width/55*scale)),padding=Math.ceil(radius*3/scale);
  const sx=Math.max(0,x-padding),sy=Math.max(0,y-padding),sw=Math.min(width,x+bw+padding)-sx,sh=Math.min(height,y+bh+padding)-sy;
  const small=document.createElement('canvas');small.width=Math.max(1,Math.ceil(sw*scale));small.height=Math.max(1,Math.ceil(sh*scale));
  const tx=small.getContext('2d',{willReadFrequently:true});if(!tx)return null;
  tx.drawImage(source,sx,sy,sw,sh,0,0,small.width,small.height);
  tx.putImageData(blurPixels(tx.getImageData(0,0,small.width,small.height),radius),0,0);
  out.imageSmoothingEnabled=true;
  out.drawImage(small,(x-sx)*small.width/sw,(y-sy)*small.height/sh,bw*small.width/sw,bh*small.height/sh,0,0,bw,bh);
  out.fillStyle='rgba(255,255,255,.08)';out.fillRect(0,0,bw,bh);small.width=small.height=0;
 }else{
  const block=Math.max(8,Math.round(width/42)),small=document.createElement('canvas');
  small.width=Math.max(1,Math.round(bw/block));small.height=Math.max(1,Math.round(bh/block));
  const tx=small.getContext('2d');if(!tx)return null;
  tx.drawImage(source,x,y,bw,bh,0,0,small.width,small.height);out.imageSmoothingEnabled=false;out.drawImage(small,0,0,small.width,small.height,0,0,bw,bh);small.width=small.height=0;
 }
 return {x,y,bw,bh,tile};
}
function drawPrivacy(ctx,width,height,rects,source){
ctx.save();ctx.globalAlpha=1;
let mosaicSrc=source;
if(!mosaicSrc&&rects.some(r=>r.mode==='mosaic')){mosaicSrc=document.createElement('canvas');mosaicSrc.width=width;mosaicSrc.height=height;mosaicSrc.getContext('2d').drawImage(ctx.canvas,0,0);}
for(const r of rects){
 const x=Math.max(0,Math.floor(r.x*width)),y=Math.max(0,Math.floor(r.y*height)),right=Math.min(width,Math.ceil((r.x+r.w)*width)),bottom=Math.min(height,Math.ceil((r.y+r.h)*height)),bw=right-x,bh=bottom-y;
 if(bw<=0||bh<=0)continue;
 if(r.mode==='mosaic'&&mosaicSrc&&typeof ctx.drawImage==='function'){
  const rendered=maskTile(mosaicSrc,width,height,r);
  if(rendered){ctx.drawImage(rendered.tile,x,y,bw,bh);rendered.tile.width=rendered.tile.height=0;}
 }else{
  ctx.fillStyle=/^#[0-9a-f]{6}$/i.test(r.color)?r.color:'#000000';
  ctx.fillRect(x,y,bw,bh);
 }
}
ctx.restore();
if(!source&&mosaicSrc){mosaicSrc.width=mosaicSrc.height=0;}
}
function composeEdits(ctx,width,height,options,rects,source){drawPrivacy(ctx,width,height,rects,source);drawWatermark(ctx,width,height,options)}
function bindWatermark(onExport){
const get=id=>document.getElementById(id),fields=get('wm-fields'),enabled=get('wm-enabled'),message=get('wm-status'),share=get('share'),layer=get('privacy-layer'),clearMasks=get('privacy-clear'),mode=get('draw-mode'),textInput=get('wm-text'),img=get('result'),retry=get('wm-apply');
const styleSolid=get('mask-style-solid'),styleMosaic=get('mask-style-mosaic'),mosaicTip=get('mask-mosaic-tip');
const mosaicStyles=get('mask-mosaic-styles'),pixelStyle=get('mask-mosaic-pixel'),glassStyle=get('mask-mosaic-glass');
let base=null,rawCanvas=null,baseURL=null,baseImage=null,generating=false,encoding=false,encodingPromise=null,dirty=false,timer=null,revision=0,drawing=false,rects=[],selected=-1,gesture=null,synced=true,defaultText=dateText(),wmKey='',controlsFrame=0,maskId=0,maskColor='#000000',maskMode='solid',mosaicStyle='glass';
const viewport=get('editor-viewport'),shell=viewport.parentElement,remove=get('privacy-delete'),maskNodes=new Map(),blockedTaps=new WeakSet(),measureCtx=document.createElement('canvas').getContext('2d');
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function currentMaskStyle(){return selected>=0&&rects[selected]?(rects[selected].mode||'solid'):maskMode}
function syncStyleButtons(){
 const activeStyle=currentMaskStyle();
 if(styleSolid){styleSolid.setAttribute('aria-pressed',String(activeStyle==='solid'));styleSolid.disabled=generating||!base;}
 const activeEffect=selected>=0&&rects[selected]?(rects[selected].style||'pixel'):mosaicStyle;
 if(styleMosaic){styleMosaic.setAttribute('aria-pressed',String(activeStyle==='mosaic'));styleMosaic.setAttribute('aria-expanded',String(activeStyle==='mosaic'));styleMosaic.disabled=generating||!base;}
 mosaicStyles.hidden=activeStyle!=='mosaic';
 for(const [button,effect] of [[pixelStyle,'pixel'],[glassStyle,'glass']]){button.setAttribute('aria-pressed',String(activeEffect===effect));button.disabled=generating||!base;}
 if(mosaicTip){mosaicTip.hidden=false;mosaicTip.textContent=activeStyle==='mosaic'?(activeEffect==='glass'?'毛玻璃':'方块马赛克'):'轻点遮盖可改色';}
}
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
function state(){fields.disabled=generating||!enabled.checked;textInput.disabled=generating||!enabled.checked;clearMasks.disabled=generating||!base||!rects.length||!!gesture;enabled.disabled=generating;mode.disabled=generating;share.disabled=!base||generating||!!gesture;retry.disabled=generating||encoding;remove.disabled=generating||!!gesture;if(remove.disabled)remove.hidden=true;syncStyleButtons();scheduleDelete();}
function setDrawing(value){drawing=value;if(!value)selected=-1;mode.setAttribute('aria-pressed',String(value));layer.classList.toggle('drawing',value);layer.style.touchAction=value?'none':'auto';paint();state();}
function makeMask(id){
 const el=document.createElement('div'),picker=document.createElement('input'),effectCanvas=document.createElement('canvas');
 el.className='privacy-rect';
 effectCanvas.className='mask-effect-preview';effectCanvas.setAttribute('aria-hidden','true');effectCanvas.hidden=true;el.appendChild(effectCanvas);
 // Make the actual color control the hit target. Some iOS Safari versions
 // return from showPicker() without opening a color panel.
 picker.type='color';picker.className='mask-color-hit';
 picker.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')blockedTaps.delete(picker)});
 picker.addEventListener('click',e=>{
  const index=rects.findIndex(r=>r.id===id);
  if(!base||!drawing||generating||gesture||index<0||blockedTaps.has(picker)||rects[index].mode==='mosaic'){e.preventDefault();return}
  selected=index;maskColor=rects[index].color;paint();state();
  // Leave the trusted click's default action intact.
 });
 for(const event of ['input','change'])picker.addEventListener(event,()=>{
  const mask=rects.find(r=>r.id===id);
  if(!base||generating||!mask||mask.mode==='mosaic'||mask.color===picker.value)return;
  mask.color=picker.value;if(rects[selected]===mask)maskColor=mask.color;changed();
 });
 const handles=['nw','ne','sw','se'].map(corner=>{
  const handle=document.createElement('span');
  handle.className='resize-handle '+corner;handle.dataset.handle=corner;el.appendChild(handle);return handle;
 });
 el.prepend(picker);layer.appendChild(el);return {el,picker,handles,effectCanvas,effectKey:''};
}
function paint(){
 const liveIds=new Set(rects.map(r=>r.id));
 for(const [id,node] of maskNodes)if(!liveIds.has(id)){node.el.remove();maskNodes.delete(id)}
 rects.forEach((r,i)=>{
  if(!maskNodes.has(r.id))maskNodes.set(r.id,makeMask(r.id));
  const node=maskNodes.get(r.id),{el,picker,handles,effectCanvas}=node,active=drawing&&i===selected,isMosaic=r.mode==='mosaic';
  el.dataset.rect=String(i);el.classList.toggle('selected',active);el.classList.toggle('is-mosaic',isMosaic);el.classList.toggle('is-synced',synced);
  el.style.cssText=`left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%;background:${synced?'transparent':isMosaic?'rgba(255,255,255,.12)':r.color}`;
  effectCanvas.hidden=synced||!isMosaic;
  if(isMosaic&&!synced){
   const source=rawCanvas||(baseImage?.complete&&baseImage.naturalWidth?baseImage:null);
   if(source){
    const width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
    const key=JSON.stringify([r.x,r.y,r.w,r.h,r.style,width,height,baseURL]);
    if(node.effectKey!==key){
     const rendered=maskTile(source,width,height,r);
     if(rendered){effectCanvas.width=rendered.bw;effectCanvas.height=rendered.bh;effectCanvas.getContext('2d').drawImage(rendered.tile,0,0);rendered.tile.width=rendered.tile.height=0;node.effectKey=key;}
    }
   }
  }
  picker.setAttribute('aria-label',`更改第 ${i+1} 处遮盖的颜色`);
  if(picker.value!==r.color)picker.value=r.color;
  picker.hidden=!drawing||isMosaic;picker.disabled=!drawing||generating||isMosaic;
  for(const handle of handles)handle.hidden=!active;
 });
 if(!drawing||selected<0)remove.hidden=true;syncStyleButtons();scheduleDelete();
}
function watermarkPreview(){const o=options(),w=img.naturalWidth||750,h=img.naturalHeight||1000;const key=JSON.stringify([o,w,h,synced]);if(key===wmKey)return;wmKey=key;svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.hidden=synced||!o.enabled||!o.text.trim();if(svg.hidden)return;const originalSize=Math.max(10,Math.min(72,+o.size||34))*w/750;let font=originalSize,margin=Math.max(10,w*.035),maxWidth=w-margin*2,text=o.text.trim().slice(0,80);measureCtx.font=`500 ${font}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;let measured=measureCtx.measureText(text).width;if(measured>maxWidth){font*=maxWidth/measured;measured=maxWidth}function put(x,y,anchor,rotate){const t=document.createElementNS(svg.namespaceURI,'text');t.textContent=text;t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('text-anchor',anchor);t.setAttribute('dominant-baseline','central');t.setAttribute('fill',o.color);t.setAttribute('opacity',Math.max(.05,Math.min(.8,+o.opacity/100)));t.setAttribute('font-size',font);t.setAttribute('font-weight','500');t.setAttribute('font-family','-apple-system, BlinkMacSystemFont, PingFang SC, sans-serif');if(rotate)t.setAttribute('transform',`rotate(-22.5 ${x} ${y})`);svg.appendChild(t)}
if(o.position==='tile'){const dx=Math.max(w*.42,measured+margin*2),dy=Math.max(w*.25,originalSize*6);let row=0;for(let y=dy/2;y<h;y+=dy,row++)for(let x=dx/2-(row%2)*dx/2;x<w+dx/2;x+=dx)put(x,y,'middle',true)}else{const p=o.position;let x=p.includes('left')?margin:w-margin,y=p.includes('top')?margin+originalSize/2:h-margin-originalSize/2,anchor=p.includes('left')?'start':'end';if(p==='center'){x=w/2;y=h/2;anchor='middle'}put(x,Math.max(originalSize/2,Math.min(h-originalSize/2,y)),anchor,false)}}
function live(){synced=false;if(baseURL&&img.src!==baseURL)img.src=baseURL;paint();watermarkPreview();}
function changed(queue=true){if(!base)return;revision++;dirty=true;retry.hidden=true;live();message.textContent='实时预览已更新，正在准备分享图片…';clearTimeout(timer);timer=null;if(queue&&!gesture)timer=setTimeout(()=>{timer=null;prepare()},280);state()}
async function prepare(){if(!base||generating||gesture)return false;if(encoding&&encodingPromise)return encodingPromise;const source=base,raw=rawCanvas,rev=revision,o=options(),masks=rects.map(r=>({...r}));if(o.enabled&&!o.text.trim()){message.textContent='请输入水印文字，或关闭文字水印。';dirty=true;state();return false}encoding=true;message.textContent='正在合成保存图片…';state();let url,canvas,ok=false;
encodingPromise=(async()=>{
try{let blob=source;if(o.enabled||masks.length){let drawSource=null;if(raw&&raw.width>0&&raw.height>0){drawSource=raw}else{url=URL.createObjectURL(source);let image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('无法读取图片。'));image.src=url});drawSource=image}canvas=document.createElement('canvas');canvas.width=drawSource.naturalWidth||drawSource.width;canvas.height=drawSource.naturalHeight||drawSource.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('内存不足，请关闭其他页面后重试。');ctx.drawImage(drawSource,0,0);composeEdits(ctx,canvas.width,canvas.height,o,masks,drawSource);blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片编码失败。')),source.type,.94))}
if(rev===revision&&source===base&&!gesture){onExport(blob);dirty=false;ok=true;const expected=img.src;const finish=()=>{if(rev===revision&&img.src===expected&&!dirty){synced=true;paint();watermarkPreview()}};if(img.complete&&img.naturalWidth)finish();else img.addEventListener('load',finish,{once:true});message.textContent='预览与保存图片已同步，可直接保存。'}
}catch(e){if(rev===revision){dirty=true;message.textContent=e.message+' 可点击重试。';retry.hidden=false}}finally{if(url)URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0}encoding=false;encodingPromise=null;if(rev!==revision&&base&&!gesture&&!generating){clearTimeout(timer);timer=setTimeout(()=>{timer=null;prepare()},0)}state()}
return ok;
})();
return encodingPromise;
}
async function ensureExported(){
 if(!base)return false;
 if(timer){clearTimeout(timer);timer=null;}
 if(encoding&&encodingPromise){await encodingPromise;}
 if(dirty&&!gesture&&!generating){await prepare();}
 return !dirty&&!encoding;
}
function applyMaskStyle(nextMode){
 maskMode=nextMode==='mosaic'?'mosaic':'solid';
 if(selected>=0&&rects[selected]&&rects[selected].mode!==maskMode){
  rects[selected].mode=maskMode;
  if(maskMode==='mosaic')rects[selected].style=mosaicStyle;
  changed();
 }else{
  paint();state();
 }
}
styleSolid?.addEventListener('click',()=>applyMaskStyle('solid'));
styleMosaic?.addEventListener('click',()=>applyMaskStyle('mosaic'));
function applyMosaicEffect(effect){
 mosaicStyle=effect;maskMode='mosaic';
 if(selected>=0&&rects[selected]){rects[selected].mode='mosaic';rects[selected].style=effect;changed();}
 else{paint();state();}
}
pixelStyle.addEventListener('click',()=>applyMosaicEffect('pixel'));
glassStyle.addEventListener('click',()=>applyMosaicEffect('glass'));
for(const event of ['input','change'])get('watermark-panel').addEventListener(event,()=>changed());
retry.addEventListener('click',()=>{retry.hidden=true;prepare()});
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
 if(kind==='new'){selected=rects.length;rects.push({id:++maskId,x:p.x,y:p.y,w:0,h:0,color:maskColor,mode:maskMode,style:mosaicStyle})}else{maskColor=rects[index].color;maskMode=rects[index].mode||'solid';if(maskMode==='mosaic')mosaicStyle=rects[index].style||'pixel';}
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
 if(rects[selected]){maskColor=rects[selected].color;maskMode=rects[selected].mode||'solid';if(maskMode==='mosaic')mosaicStyle=rects[selected].style||'pixel';}
 if(g.kind!=='move'||g.moved||dirty)changed();else{paint();state()}
}
function finish(e,cancel){if(!gesture||e.pointerId!==gesture.pointerId)return;if(cancel){cancelGesture();return}const g=gesture;update(e);const r=rects[g.index],b=layer.getBoundingClientRect();if(r.w*b.width<3||r.h*b.height<3){if(g.kind==='new')rects.splice(g.index,1);else rects[g.index]=g.original}gesture=null;if(selected>=rects.length)selected=rects.length-1;if(rects[selected]){maskColor=rects[selected].color;maskMode=rects[selected].mode||'solid';if(maskMode==='mosaic')mosaicStyle=rects[selected].style||'pixel';}if(g.picker&&g.moved)blockedTaps.add(g.picker);if(g.kind==='move'&&!g.moved){state();if(dirty&&!timer&&!encoding)changed()}else changed()}
layer.addEventListener('pointerup',e=>finish(e,false));for(const name of ['pointercancel','lostpointercapture'])layer.addEventListener(name,e=>finish(e,true));
img.addEventListener('contextmenu',e=>{if(dirty||encoding)e.preventDefault()});img.addEventListener('load',()=>{if(!synced)watermarkPreview()});
function clearState(){revision++;clearTimeout(timer);timer=null;dirty=false;rects=[];selected=-1;gesture=null;synced=true;setDrawing(false);retry.hidden=true;if(baseURL)URL.revokeObjectURL(baseURL);baseURL=null;if(baseImage){baseImage.onload=null;baseImage.src='';baseImage=null;}if(rawCanvas){rawCanvas.width=rawCanvas.height=0;rawCanvas=null;}}
state();retry.hidden=true;return {setBase(blob,canvas){clearState();base=blob;rawCanvas=canvas||null;baseURL=URL.createObjectURL(blob);baseImage=new Image();baseImage.onload=()=>{if(!synced)paint();};baseImage.src=baseURL;if(!textInput.value||textInput.value===defaultText){defaultText=dateText();textInput.value=defaultText}enabled.checked=false;watermarkPreview();message.textContent='编辑会实时预览，点「保存」时自动合成导出。';state()},reset(){clearState();base=null;enabled.checked=false;defaultText=dateText();maskColor='#000000';maskMode='solid';mosaicStyle='glass';for(const [id,value]of Object.entries({'wm-text':defaultText,'wm-position':'bottom-right','wm-size':'34','wm-opacity':'20','wm-color':'#1d3437'}))get(id).value=value;watermarkPreview();message.textContent='编辑会实时预览，点「保存」时自动合成导出。';state()},cancelGesture,pauseDrawing(){cancelGesture();setDrawing(false)},setGenerating(v){generating=v;paint();state()},hasPendingEdits:()=>dirty||encoding||!!timer,ensureExported};
}
root.ScrollshotExtras={drawWatermark,drawPrivacy,composeEdits,dateText,bindWatermark,blurPixels};
})(typeof globalThis==='object'?globalThis:this);


