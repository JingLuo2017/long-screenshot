/* Pure, injectable stitching pipeline; no DOM or video seeks during export. */
(function(root){
function score(a,b,w,h,d){let err=0,n=0;let end=Math.min(h-d-1,Math.round(h*.95)-d);for(let y=Math.max(1,Math.round(h*.05));y<end;y+=3)for(let x=5;x<w-5;x+=3){let i=(y*w+x)*4,j=((y+d)*w+x)*4;let edge=Math.abs(a[j]-a[j+4])+Math.abs(a[j]-a[j+w*4]);if(edge<8)continue;err+=Math.min(Math.abs(a[j]-b[i])+Math.abs(a[j+1]-b[i+1])+Math.abs(a[j+2]-b[i+2]),120);n++}return n<18?999:err/(n*3)}
function match(a,b,w,h,max){let best=999,shift=0,values=[];for(let d=0;d<max;d++){let s=score(a,b,w,h,d);values[d]=s;if(s<best){best=s;shift=d}}let second=999;for(let d=0;d<values.length;d++)if(Math.abs(d-shift)>3)second=Math.min(second,values[d]);return {best,shift,ambiguous:shift>=2&&second-best<1&&second<best*1.1}}
function seam(data,w,h,base,lower){let lo=Math.max(3,lower,base-15),hi=Math.min(h-4,base+15),best=Infinity,chosen=Math.min(h-4,Math.max(3,lower,base));for(let y=lo;y<=hi;y++){let e=Math.abs(y-base)*2;for(let x=8;x<w-8;x+=2){let i=(y*w+x)*4;for(let c=0;c<3;c++)e+=Math.abs(data[i+c]-data[i-w*4+c])+Math.abs(data[i+c]-data[i+4+c])}if(e<best){best=e;chosen=y}}return chosen}
async function build(o){let {crop,w,h,fw,fh,percent,duration,read,encode,onProgress=()=>{}}=o;
let parts=[],total=0,previous=null,cut=Math.round(crop*percent/100),retained=null,residual=0,lastAttempt=0,matches=0,retries=0,failed=0,initialFailures=0,reads=0;
const end=Math.max(0,duration-1/60),minimum=1/30;
async function commit(frame,pixels){let start=cut-pixels;if(start<0)throw Error('internal overlap range');let row=seam(frame.coarse,w,h,Math.round(h*percent/100),Math.ceil((start+2)*h/crop));let next=Math.max(start+1,Math.min(crop-1,Math.round(row*crop/h))),height=next-start;
const blob=await encode(frame,start,height);if(retained&&retained.release)retained.release();retained=frame;
parts.push({blob,h:height,time:frame.time,y:start});total+=height;cut=next;previous={time:frame.time,coarse:frame.coarse,fine:frame.fine};matches++;initialFailures=0;
}
async function visit(time,force=false,depth=0){const from=Math.max(lastAttempt,previous?previous.time:0);let frame=await read(time);reads++;
try{if(!previous){parts=[{blob:await encode(frame,0,cut),h:cut,time:frame.time,y:0}];total=cut;if(retained&&retained.release)retained.release();retained=frame;previous={time:frame.time,coarse:frame.coarse,fine:frame.fine};lastAttempt=time;return}
let max=Math.max(3,Math.floor(h*Math.min(.6,percent/100))),m=match(previous.coarse,frame.coarse,w,h,max);
let risky=m.best>=20||m.ambiguous||m.shift>=max*.72;
if(risky&&time-from>minimum*1.15&&depth<5){if(frame.release)frame.release();frame=null;retries++;let mid=(from+time)/2;await visit(mid,true,depth+1);await visit(time,force,depth+1);return}
if(m.best<20&&m.shift>=(force?2:20)&&!m.ambiguous){let center=m.shift*fh/h,best=Infinity,shift=0;for(let d=Math.max(0,Math.floor(center)-5);d<=Math.min(fh-2,Math.ceil(center)+5);d++){let s=score(previous.fine,frame.fine,fw,fh,d);if(s<best){best=s;shift=d}}
let exact=(best<20?shift*crop/fh:m.shift*crop/h)+residual,pixels=Math.max(1,Math.round(exact));
// Subdivide before any source rows would fall outside the viewport.
if(pixels>cut&&time-from>minimum*1.15&&depth<5){if(frame.release)frame.release();frame=null;retries++;await visit((from+time)/2,true,depth+1);await visit(time,force,depth+1);return}
if(pixels<=cut){residual=exact-pixels;await commit(frame,pixels)}else failed++;
}else if(m.best>=20||m.ambiguous){failed++;if(matches===0&&++initialFailures>=4){parts=[{blob:await encode(frame,0,cut),h:cut,time:frame.time,y:0}];total=cut;if(retained&&retained.release)retained.release();retained=frame;previous={time:frame.time,coarse:frame.coarse,fine:frame.fine};residual=0;initialFailures=0}}
lastAttempt=time;
}finally{if(frame&&frame!==retained&&frame.release)frame.release();onProgress({time,reads,matches,retries,failed})}}
try{await visit(0);for(let t=.25;t<end;t+=.25)await visit(t);if(end>lastAttempt+.001)await visit(end,true);
if(!matches)throw Error('没有识别到连续滚动内容，请检查画面区域设置。');parts.push({blob:await encode(retained,cut,crop-cut),h:crop-cut,time:previous.time,y:cut});total+=crop-cut;return {parts,total,matches,retries,failed,reads}}finally{if(retained&&retained.release)retained.release()}}
root.ScrollshotCore={score,match,seam,build};
})(typeof globalThis==='object'?globalThis:this);
