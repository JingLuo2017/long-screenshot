(function(root){
'use strict';
const abortError=()=>new DOMException('已取消生成','AbortError');
function checkAbort(signal){if(signal.aborted)throw abortError();}
function cancellable(signal,start){
 checkAbort(signal);
 return new Promise((resolve,reject)=>{
  let settled=false,dispose=null;
  const finish=(callback,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);dispose?.();callback(value);};
  const abort=()=>finish(reject,abortError());
  signal.addEventListener('abort',abort,{once:true});
  try{dispose=start(value=>finish(resolve,value),error=>finish(reject,error));if(settled)dispose?.();}catch(error){finish(reject,error);}
 });
}
function metadata(video,signal){
 return cancellable(signal,(resolve,reject)=>{
  const loaded=()=>resolve(),failed=()=>reject(Error('无法读取录屏'));
  const timeout=setTimeout(()=>reject(Error('读取录屏超时')),12000);
  video.addEventListener('loadedmetadata',loaded);video.addEventListener('error',failed);
  return ()=>{clearTimeout(timeout);video.removeEventListener('loadedmetadata',loaded);video.removeEventListener('error',failed);};
 });
}
const MAX_DURATION=90;
function openMedia(source,signal){
 const url=URL.createObjectURL(source),video=document.createElement('video');
 video.preload='auto';video.muted=true;video.playsInline=true;
 // Keep the decoder attached for mobile browsers that defer detached video rendering.
 video.style.cssText='position:fixed;width:2px;height:2px;left:0;bottom:0;opacity:.01;pointer-events:none';video.setAttribute('aria-hidden','true');document.body.appendChild(video);
 const ready=metadata(video,signal);video.src=url;
 return {video,ready,close(){video.pause();video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(url);}};
}
function videoInfo(video){
 const duration=video.duration,width=video.videoWidth,height=video.videoHeight;
 if(!Number.isFinite(duration)||duration<=0||!width||!height)throw Error('无法读取录屏');
 if(duration>MAX_DURATION)throw Error('录屏超过 90 秒');
 return {duration,width,height};
}
async function inspect(source,signal){
 checkAbort(signal);const media=openMedia(source,signal);
 try{
  await media.ready;checkAbort(signal);
  const info=videoInfo(media.video);
  if(media.video.readyState<2)await seek(media.video,Math.min(.08,info.duration/2),signal);
  checkAbort(signal);if(media.video.readyState<2)throw Error('无法解码录屏');
  return info;
 }finally{media.close();}
}
function inspectError(error){
 const message=String(error?.message||'');
 if(message.includes('90 秒'))return '这段录屏超过 90 秒。请在相册中裁短后重新选择。';
 if(message.includes('超时'))return '读取录屏超时。请保持页面在前台，再重新选择这段录屏。';
 return '无法读取这段录屏。请确认它能在相册播放，或选择另一段录屏。';
}
function seek(video,time,signal){
 checkAbort(signal);
 if(Math.abs(video.currentTime-time)<.0001&&video.readyState>=2&&!video.seeking)return Promise.resolve();
 return cancellable(signal,(resolve,reject)=>{
  let doneSeek=false,doneFrame=false,callback=null,frameTimer=null,raf=null;
  const finish=()=>{if(doneSeek&&doneFrame)resolve();};
  const fallback=()=>{raf=requestAnimationFrame(()=>{raf=requestAnimationFrame(()=>{doneFrame=true;finish();});});};
  const sought=()=>{doneSeek=true;if(!video.requestVideoFrameCallback)fallback();else if(!doneFrame)frameTimer=setTimeout(fallback,180);finish();};
  const failed=()=>reject(Error('无法解码录屏'));
  const timeout=setTimeout(()=>reject(Error('读取画面超时')),10000);
  video.addEventListener('seeked',sought);video.addEventListener('error',failed);
  const watch=()=>{callback=video.requestVideoFrameCallback((_,frame)=>{if(Math.abs(frame.mediaTime-time)<=.075){doneFrame=true;finish();}else watch();});};
  if(video.requestVideoFrameCallback)watch();
  try{video.currentTime=time;}catch(error){reject(error);}
  return ()=>{clearTimeout(timeout);clearTimeout(frameTimer);if(raf!==null)cancelAnimationFrame(raf);if(callback!==null)video.cancelVideoFrameCallback?.(callback);video.removeEventListener('seeked',sought);video.removeEventListener('error',failed);};
 });
}
function encode(canvas,signal,type='image/png',quality){
 return cancellable(signal,(resolve,reject)=>{canvas.toBlob(blob=>blob?resolve(blob):reject(Error('图片编码失败')),type,quality);});
}
async function decode(blob,signal){
 const url=URL.createObjectURL(blob);
 try{return await cancellable(signal,(resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('图片编码失败'));image.src=url;return ()=>{image.onload=image.onerror=null;};});}
 finally{URL.revokeObjectURL(url);}
}
function guidance(error){
 const message=String(error?.message||'');
 if(message.includes('90 秒'))return '录屏超过 90 秒。请在相册裁剪成 90 秒以内，再返回选择。';
 if(message.includes('连续滚动'))return '没有识别到连续滚动。请检查蓝线之间是否包含滚动内容；也可以重新录屏，缓慢向同一方向滑动。';
 if(message.includes('超时'))return '读取画面超时。请保持页面在前台，再点“生成长截图”重试。';
 if(message.includes('内存')||message.includes('编码'))return '生成图片时遇到尺寸或内存限制。请把录屏裁成较短的片段后重试。';
 if(message.includes('录屏'))return '无法读取这段录屏。请确认它能在相册播放，或返回选择另一段录屏。';
 return '未能生成长截图。请保持页面在前台重试；如果仍失败，可先将录屏裁成较短的一段。';
}
function mount({cropEditor,onBusy,onResult}){
 const get=id=>document.getElementById(id),file=get('file'),progress=get('progress'),label=get('progress-percent'),phase=get('generate-phase'),hint=get('generate-hint'),cancel=get('cancel-generation'),status=get('status'),fields=get('generation-settings');
 let job=null;
 cancel.addEventListener('click',()=>{if(!job||job.signal.aborted)return;cancel.disabled=true;phase.textContent='正在取消…';hint.textContent='正在停止当前处理，录屏和设置会保留。';job.abort();});
 async function run(){
  if(job||!file.files.length)return false;
  const cropValues=cropEditor.values(),invalid=ScrollshotCrop.validate(cropValues);
  if(invalid){status.textContent=invalid.message;cropEditor.showError(invalid);return false;}
  const {top,bottom,seam:percent}=cropValues,format=get('format').value,source=file.files[0];
  const controller=new AbortController(),signal=controller.signal;job=controller;
  let media,small,fine,out,result,success=false,stage='',start=0;
  function report(nextStage,value,stageRatio){
   if(signal.aborted)return;
   if(stage!==nextStage){stage=nextStage;start=performance.now();phase.textContent=stage;}
   progress.value=Math.min(1,Math.max(progress.value,value));label.textContent=Math.floor(progress.value*100)+'%';
   const seconds=(performance.now()-start)/1000,remaining=Math.ceil(seconds*(1-stageRatio)/stageRatio);
   hint.textContent=seconds>=2&&stageRatio>=.15&&stageRatio<.98&&remaining>=2&&remaining<180?`本阶段预计还需约 ${remaining} 秒，请保持页面在前台。`:'正在本机处理，请保持页面在前台。';
  }
  file.disabled=true;fields.disabled=true;onBusy(true);cropEditor.suspend();cancel.disabled=false;status.textContent='';progress.value=0;report('正在识别画面',0,0);cancel.focus({preventScroll:true});
  try{
   media=openMedia(source,signal);await media.ready;checkAbort(signal);
   const video=media.video,{duration,width:W,height:H}=videoInfo(video);
   const y0=Math.round(H*top/100),crop=Math.round(H*(1-bottom/100))-y0,w=160,h=Math.round(crop*w/W),fw=480,fh=Math.round(crop*fw/W);
   small=document.createElement('canvas');fine=document.createElement('canvas');small.width=w;small.height=h;fine.width=fw;fine.height=fh;
   const sx=small.getContext('2d',{willReadFrequently:true}),fx=fine.getContext('2d',{willReadFrequently:true});if(!sx||!fx)throw Error('内存不足');
   result=await ScrollshotCore.build({crop,w,h,fw,fh,percent,duration,
    read:async time=>{await seek(video,time,signal);checkAbort(signal);const snapshot=document.createElement('canvas');snapshot.width=W;snapshot.height=crop;try{snapshot.getContext('2d').drawImage(video,0,y0,W,crop,0,0,W,crop);sx.drawImage(snapshot,0,0,w,h);fx.drawImage(snapshot,0,0,fw,fh);return{time,canvas:snapshot,coarse:sx.getImageData(0,0,w,h).data,fine:fx.getImageData(0,0,fw,fh).data,release(){snapshot.width=snapshot.height=0;}};}catch(error){snapshot.width=snapshot.height=0;throw error;}},
    encode:async(frame,y,height)=>{checkAbort(signal);const slice=document.createElement('canvas');slice.width=W;slice.height=height;try{slice.getContext('2d').drawImage(frame.canvas,0,y,W,height,0,0,W,height);return await encode(slice,signal);}finally{slice.width=slice.height=0;}},
    onProgress:({time})=>{const ratio=Math.min(1,time/duration);report('正在识别画面',ratio*.85,ratio);}
   });
   checkAbort(signal);report('正在生成图片',.85,0);
   const {parts,total,failed}=result,factor=Math.min(1,14500/total,Math.sqrt(12000000/(W*total)));
   out=document.createElement('canvas');out.width=Math.max(1,Math.floor(W*factor));out.height=Math.max(1,Math.floor(total*factor));const ox=out.getContext('2d');if(!ox)throw Error('内存不足');
   let pos=0;
   for(let i=0;i<parts.length;i++){
    const part=parts[i],image=await decode(part.blob,signal);checkAbort(signal);
    const a=Math.round(pos*factor),b=Math.min(out.height,Math.round((pos+part.h)*factor));if(b>a)ox.drawImage(image,0,a,out.width,b-a);
    pos+=part.h;part.blob=null;const ratio=(i+1)/parts.length;report('正在生成图片',.85+.14*ratio,ratio);
    await new Promise(resolve=>setTimeout(resolve,0));checkAbort(signal);
   }
   const blob=await encode(out,signal,format==='png'?'image/png':'image/jpeg',.94);checkAbort(signal);
   onResult(blob);success=true;
   status.textContent=`生成完成：${out.width} × ${out.height} 像素，${(blob.size/1024/1024).toFixed(2)} MB。${factor<1?'图片较长，已自动缩小。':''}${failed?'部分画面没有足够重叠或存在动画，请检查有无遗漏。':''}`;
   report('正在生成图片',1,1);return true;
  }catch(error){status.textContent=signal.aborted?'已取消生成。录屏和设置已保留，可直接重新生成。':guidance(error);return false;}
  finally{
   media?.close();
   for(const canvas of [small,fine,out])if(canvas)canvas.width=canvas.height=0;
   if(result)for(const part of result.parts)part.blob=null;
   job=null;file.disabled=false;fields.disabled=false;cancel.disabled=true;onBusy(false);
   if(!success){cropEditor.resume();requestAnimationFrame(()=>get('go').focus({preventScroll:true}));}
  }
 }
 return {run};
}
root.ScrollshotGeneration={mount,guidance,inspect,inspectError};
})(typeof globalThis==='object'?globalThis:this);
