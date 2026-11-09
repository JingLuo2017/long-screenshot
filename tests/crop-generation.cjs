const assert=require('node:assert/strict');
require('../crop.js');require('../generation.js');
const {geometry,validate,limitFor}=ScrollshotCrop;
assert.deepEqual(geometry({top:12,bottom:12,seam:45}),{top:12,bottom:12,seam:45,kept:76,line:46.2});
const edited=geometry({top:20,bottom:15,seam:60});assert.equal(edited.kept,65);assert.equal(edited.line,59);
for(const top of [0,12,29,40])for(const bottom of [0,12,29,40]){
 const g=geometry({top,bottom,seam:45});assert(g.kept>=31);assert(g.line>g.top&&g.line<100-g.bottom);
}
assert.equal(limitFor(40),29);assert.equal(validate({top:40,bottom:29,seam:70}),null);
for(const v of [{top:80,bottom:12,seam:45},{top:40,bottom:40,seam:45},{top:12,bottom:12,seam:NaN},{top:12,bottom:12,seam:71}])assert(validate(v)?.message);
for(const [e,re] of [['没有识别到连续滚动内容',/蓝线/],['录屏超过 90 秒',/相册裁剪/],['读取画面超时',/前台/],['图片编码失败',/较短/],['无法读取录屏',/另一段/]])assert.match(ScrollshotGeneration.guidance(Error(e)),re);
console.log('PASS crop geometry, limits, seam reference and actionable generation errors');
