const sharp=require('sharp'),fs=require('fs');
const root='/home/claude/kcct-capture';
const mark=fs.readFileSync(root+'/app/assets/logo-mark.svg');
async function icon(size,pad,bg,out){
  const inner=Math.round(size*(1-pad*2));
  const m=await sharp(mark,{density:300}).resize(inner,inner,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  await sharp({create:{width:size,height:size,channels:4,background:bg}}).composite([{input:m,gravity:'center'}]).png().toFile(out);
}
(async()=>{
  const bg={r:246,g:241,b:250,alpha:1};
  await icon(192,0.14,bg,root+'/app/icons/icon-192.png');
  await icon(512,0.14,bg,root+'/app/icons/icon-512.png');
  await icon(512,0.26,bg,root+'/app/icons/icon-maskable-512.png');
  await icon(180,0.14,bg,root+'/app/icons/apple-touch-icon.png');
  const d={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
  for(const [k,s] of Object.entries(d)){
    fs.mkdirSync(`${root}/android-icons/mipmap-${k}`,{recursive:true});
    await icon(s,0.12,bg,`${root}/android-icons/mipmap-${k}/ic_launcher.png`);
    fs.copyFileSync(`${root}/android-icons/mipmap-${k}/ic_launcher.png`,`${root}/android-icons/mipmap-${k}/ic_launcher_round.png`);
  }
})();
