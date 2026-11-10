(function(root){
'use strict';
function mount(options){
 const get=id=>document.getElementById(id),file=get('file'),go=get('go'),quick=get('quick-generate'),recordingStatus=get('recording-status'),retryRecording=get('retry-recording'),quickStatus=get('quick-status');
 const clearDialog=get('clear-dialog');
 const originalGenerate=go.onclick,recommended=['12','12','45','jpeg'].join('|'),key=()=>['top','bottom','seam','format'].map(id=>get(id).value).join('|');
 let step=1,resultKey=null,resultFile=null,resultStatus=null,resultReturnStep=2,running=false,probe=null,validatedFile=null;
 const busy=()=>running||file.disabled;
 const ready=()=>!!validatedFile&&validatedFile===file.files[0];
 const cached=()=>ready()&&options.hasResult()&&resultFile===file.files[0]&&resultKey===key();
 function refresh(){
  const locked=busy(),usable=ready(),reuse=cached(),defaults=key()===recommended;
  get('quick-options').hidden=!usable;
  quick.disabled=go.disabled=locked||!usable;
  for(const id of ['adjust-crop','adjust-format'])get(id).disabled=locked||!usable;
  get('adjust-format').textContent='图片格式 · '+(get('format').value==='png'?'PNG':'JPEG');
  quick.textContent=reuse?'继续查看结果':defaults?'使用推荐设置生成':'使用当前设置生成';
  get('quick-settings-summary').textContent=defaults?'推荐设置：默认画面范围，JPEG 格式。':'生成时将使用你调整后的画面范围和图片格式。';
  document.querySelectorAll('[data-back]').forEach(b=>b.disabled=locked||step===1);
  document.querySelectorAll('[data-clear]').forEach(b=>b.disabled=locked);
  go.textContent=locked?'正在处理…':reuse?'继续查看结果':'生成长截图';
  get('flow-busy').hidden=!locked;get('panel-2').classList.toggle('is-generating',locked);
 }
 function show(value){
  step=value;options.onStepChange?.(step,running);
  for(let i=1;i<=3;i++){get('panel-'+i).hidden=i!==step;const li=document.querySelector(`[data-step="${i}"]`);li.classList.toggle('active',i===step);li.classList.toggle('done',i<step);if(i===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');}
  get('step-announcement').textContent=`第 ${step} 步 / 共 3 步：${['选择录屏','设置与生成','编辑保存'][step-1]}`;
  if(step===3)get('result-summary').textContent=resultStatus??get('status').textContent;
  refresh();get('step-announcement').focus({preventScroll:true});
 }
 function stopProbe(){const old=probe;probe=null;old?.abort();}
 function resetSelection(){stopProbe();validatedFile=null;recordingStatus.textContent='';recordingStatus.removeAttribute('data-kind');retryRecording.hidden=true;quickStatus.textContent='';}
 async function inspectSelection(){
  resetSelection();const selected=file.files[0];get('status').textContent='请选择一段录屏。';
  if(!selected){refresh();return;}
  const controller=new AbortController();probe=controller;
  recordingStatus.dataset.kind='checking';recordingStatus.textContent='正在检查录屏…';refresh();
  try{
   const info=await options.inspect(selected,controller.signal);
   if(probe!==controller||file.files[0]!==selected)return;
   validatedFile=selected;recordingStatus.dataset.kind='ready';
   const seconds=info.duration<1?info.duration.toFixed(2):info.duration.toFixed(1);
   recordingStatus.textContent=`录屏已就绪 · ${seconds} 秒`;
   get('status').textContent='录屏已就绪，可生成长截图。';
  }catch(error){
   if(probe!==controller||file.files[0]!==selected)return;
   recordingStatus.dataset.kind='error';recordingStatus.textContent=options.inspectError(error);
   retryRecording.hidden=error?.code!=='MEDIA_TIMEOUT';
  }finally{if(probe===controller){probe=null;refresh();}}
 }
 function clear(){
  if(busy()||clearDialog.open)return;
  clearDialog.returnValue='cancel';clearDialog.showModal();
 }
 get('clear-cancel').addEventListener('click',()=>clearDialog.close('cancel'));
 get('clear-confirm').addEventListener('click',()=>clearDialog.close('clear'));
 clearDialog.addEventListener('close',()=>{
  if(clearDialog.returnValue!=='clear'||busy())return;
  resetSelection();options.reset();resultKey=null;resultFile=null;resultStatus=null;resultReturnStep=2;
  quickStatus.textContent='已清空，可以选择新的录屏。';show(1);
  get('step-announcement').scrollIntoView({block:'nearest'});
 });
 function openSettings(section){
  if(busy()||!ready())return;
  get('capture-settings').open=section==='crop';show(2);
  const target=section==='crop'?get('capture-settings').querySelector('summary'):get('format');
  target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});
 }
 get('adjust-crop').addEventListener('click',()=>openSettings('crop'));
 get('adjust-format').addEventListener('click',()=>openSettings('format'));
 document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>{if(!busy()&&step>1)show(step===3?resultReturnStep:1);}));
 document.querySelectorAll('[data-clear]').forEach(b=>b.addEventListener('click',clear));
 file.addEventListener('change',inspectSelection);
 file.addEventListener('click',()=>{
  // Browsers can suppress change when the user picks the same file again.
  // Clear a failed choice before reopening the picker, never a usable one.
  if(recordingStatus.dataset.kind==='error'&&!busy()){file.value='';inspectSelection();}
 });
 retryRecording.addEventListener('click',()=>{if(!busy()&&!probe&&!retryRecording.hidden)inspectSelection();});
 for(const id of ['top','bottom','seam','format'])get(id).addEventListener('change',refresh);
 async function generate(){
  if(busy()||!ready())return;
  const origin=step;
  if(cached()){resultReturnStep=origin;show(3);return;}
  const thisFile=file.files[0],thisKey=key();let success=false;
  quickStatus.textContent='';running=true;
  if(origin===1)show(2);else refresh();
  try{
   success=await originalGenerate();
   if(success&&options.hasResult()&&!get('output').hidden){resultFile=thisFile;resultKey=thisKey;resultStatus=get('status').textContent;resultReturnStep=origin;show(3);}
  }finally{
   running=false;
   if(!success&&origin===1){quickStatus.textContent=get('status').textContent;show(1);quick.focus({preventScroll:true});}
   else refresh();
  }
 }
 go.onclick=quick.onclick=generate;
 new MutationObserver(refresh).observe(file,{attributes:true,attributeFilter:['disabled']});
 show(1);if(file.files.length)inspectSelection();return {show,clear,refresh};
}
root.ScrollshotFlow={mount};
})(typeof globalThis==='object'?globalThis:this);
