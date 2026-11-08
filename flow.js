(function(root){
function mount(options){const get=id=>document.getElementById(id),file=get('file'),go=get('go');let step=1,resultKey=null,resultFile=null,running=false;
const originalGenerate=go.onclick,key=()=>['top','bottom','seam','format'].map(id=>get(id).value).join('|');
const busy=()=>running||file.disabled;
function refresh(){const locked=busy(),hasFile=file.files.length>0,cached=options.hasResult()&&resultFile===file.files[0]&&resultKey===key();get('next-select').disabled=locked||!hasFile;document.querySelectorAll('[data-back]').forEach(b=>b.disabled=locked||step===1);document.querySelectorAll('[data-clear]').forEach(b=>b.disabled=locked);go.textContent=locked?'正在处理…':cached?'继续查看结果':'生成长截图';get('flow-busy').hidden=!locked;}
function show(value){step=value;options.onStepChange?.(step);for(let i=1;i<=3;i++){get('panel-'+i).hidden=i!==step;const li=document.querySelector(`[data-step="${i}"]`);li.classList.toggle('active',i===step);li.classList.toggle('done',i<step);if(i===step)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current')}get('step-announcement').textContent=`第 ${step} 步 / 共 3 步：${['选择录屏','设置与生成','水印与保存'][step-1]}`;if(step===3)get('result-summary').textContent=get('status').textContent;refresh();get('step-announcement').focus({preventScroll:true})}
function clear(){if(busy())return;if(!window.confirm('确定清空全部内容吗？录屏、参数、水印设置和生成结果都会清除，并返回第一步。此操作无法撤销。'))return;options.reset();resultKey=null;resultFile=null;show(1)}
get('next-select').addEventListener('click',()=>{if(file.files.length&&!busy())show(2)});document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>{if(!busy()&&step>1)show(step-1)}));document.querySelectorAll('[data-clear]').forEach(b=>b.addEventListener('click',clear));
file.addEventListener('change',refresh);for(const id of ['top','bottom','seam','format'])get(id).addEventListener('change',refresh);
go.onclick=async()=>{if(busy()||!file.files.length)return;if(options.hasResult()&&resultFile===file.files[0]&&resultKey===key()){show(3);return}const thisFile=file.files[0],thisKey=key();running=true;refresh();try{await originalGenerate();if(options.hasResult()&&!get('output').hidden){resultFile=thisFile;resultKey=thisKey;show(3)}}finally{running=false;refresh()}};
new MutationObserver(refresh).observe(file,{attributes:true,attributeFilter:['disabled']});show(1);return {show,clear,refresh};
}
root.ScrollshotFlow={mount};
})(typeof globalThis==='object'?globalThis:this);
