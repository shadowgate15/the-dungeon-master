import fs from 'node:fs'
const words=s=>new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean))
const jac=(a,b)=>{const A=words(a),B=words(b);let i=0;for(const w of A)if(B.has(w))i++;return i/(A.size+B.size-i||1)}
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))]}
const wrap=v=>/^["'“”‘`]/.test(v)||/["'”`]$/.test(v)||/^(premise|here|revised|new)\b/i.test(v)||/\*\*|^#|\n/.test(v)
for(const f of fs.readdirSync('.').filter(f=>f.startsWith('res-'))){
 const r=JSON.parse(fs.readFileSync(f));console.log('\n##',r.model)
 for(const k of ['gen','rev']){
  const a=r[k], vals=a.filter(x=>x.parseOk).map(x=>x.value), L=vals.map(v=>v.length)
  console.log(k,'n',a.length,'parseOk',vals.length,'finish!=stop',a.filter(x=>x.finish!=='stop').length,'errs',a.filter(x=>x.err).length,
   '| len min/p25/med/p75/max',Math.min(...L),q(L,.25),q(L,.5),q(L,.75),Math.max(...L),
   '| in300-400',L.filter(l=>l>=300&&l<=400).length,'<300',L.filter(l=>l<300).length,'>400',L.filter(l=>l>400).length,'>600',L.filter(l=>l>600).length,
   '| wrapped',vals.filter(wrap).length,'| medMs',q(a.map(x=>x.ms),.5),'medTok',q(a.map(x=>x.tokens||0),.5))
  if(k==='rev'){
   const ex=a.filter(x=>x.parseOk&&x.value.trim()===x.before.trim()).length
   const near=a.filter(x=>x.parseOk&&jac(x.value,x.before)>=0.8).length
   const lenDelta=a.filter(x=>x.parseOk).map(x=>Math.abs(x.value.length-x.before.length)/Math.max(1,x.before.length))
   console.log('  unchanged exact',ex,'near(jaccard>=.8)',near,'| mean jaccard',(a.filter(x=>x.parseOk).reduce((s,x)=>s+jac(x.value,x.before),0)/vals.length).toFixed(2),'| reduced when note=shorter/simplify:',a.filter(x=>/shorter|simplify/.test(x.note)).map(x=>`${x.before.length}->${x.value?.length}`).join(' '))
  }
 }
 console.log('sample gen:',r.gen[0].value); console.log('sample rev (',r.rev[2].note,'):',r.rev[2].value)
}
