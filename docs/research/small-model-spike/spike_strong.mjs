import fs from 'node:fs'
const model = process.argv[2]
const out = process.argv[3]
const URL = 'http://localhost:1234/v1/chat/completions'
const SYSTEM = `You are helping a player create a World: the lasting setting that many tabletop role-playing campaigns can be set in. A World is a place, not a story.
Write only the premise field. The premise describes the World itself in a few sentences, exactly 3 sentences, about 350 characters (roughly 55 words), never more than 450 characters: what it is like, what makes it distinctive, and the lasting conditions, powers or tensions that shape life in it. Write it as a description of a place and its present state, in the present tense. Do not write a plot, quest, chosen-one tale or character arc, and do not name protagonists or tell a sequence of events; adventures happen later, inside the World. Stay consistent with the genre flavor, scale, magic level and tech level when they are set.`
const genres = ['high fantasy','dark fantasy','sword and sorcery','gothic horror','steampunk','mythic','swashbuckling','post-apocalyptic fantasy','fairy tale','weird west']
const scales = ['a single city','a region','a continent','a world','a planar realm']
const magic = ['none','low','medium','high']
const tech = ['stone age','medieval','renaissance','industrial']
const names = ['Vael Dorun','The Ashen Reach','Korrin\'s Rest','Mistmoor','Thalassar','The Hollow Crown','Ember Isles','Quillhaven','Dreadmere','Sunken Aurel']
const ctxs = Array.from({length:20},(_,i)=>({name:names[i%10],genreFlavor:genres[(i*3)%10],scale:scales[i%5],magicLevel:magic[i%4],techLevel:tech[(i*2)%4]}))
const notes = ['make it darker','shorter','more political intrigue','less magic, more mundane','add a mention of trade','make it feel hopeful','focus on the weather and landscape','more mysterious','emphasize a looming threat to everyone','make it funnier','mention an ancient ruin','simplify the wording','more about religion','make the people poorer','add a rival faction','make it more cinematic','focus on a single dominant power','less grim','more detail about food and daily life','make it stranger']
const schema = {type:'object',properties:{premise:{type:'string'}},required:['premise'],additionalProperties:false}
function seedBlock(c, cur, note){
  const lines = [`- Name: ${c.name}`,`- Genre flavor: ${c.genreFlavor}`,`- Scale: ${c.scale}`,`- Magic level: ${c.magicLevel}`,`- Tech level: ${c.techLevel}`]
  let s = `Other fields (the user may have edited them):\n${lines.join('\n')}\n\n`
  if (cur===undefined) return s+'Write a new premise.'
  return s+`Current premise:\n${cur}\n\nThe player's feedback: ${note}\nWrite a revised premise that applies the feedback.`
}
async function call(user){
  const t=Date.now()
  const r = await fetch(URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:SYSTEM},{role:'user',content:user}],max_tokens:600,temperature:0.7,response_format:{type:'json_schema',json_schema:{name:'field',strict:true,schema}}})})
  const j = await r.json(); const ms=Date.now()-t
  const raw = j.choices?.[0]?.message?.content ?? ''
  let value=null, parseOk=false
  try{ value=JSON.parse(raw).premise; parseOk=typeof value==='string' }catch{}
  return {raw,value,parseOk,finish:j.choices?.[0]?.finish_reason,tokens:j.usage?.completion_tokens,ms,reasoning:!!j.choices?.[0]?.message?.reasoning_content, err:j.error?.message}
}
const res={model,gen:[],rev:[]}
for(let i=0;i<20;i++){ res.gen.push({ctx:ctxs[i],...await call(seedBlock(ctxs[i]))}); process.stderr.write('g') }
for(let i=0;i<20;i++){
  const cur = res.gen[i].value ?? ''
  res.rev.push({ctx:ctxs[i],note:notes[i],before:cur,...await call(seedBlock(ctxs[i],cur,notes[i]))}); process.stderr.write('r')
}
fs.writeFileSync(out,JSON.stringify(res,null,1))
