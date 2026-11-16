// Pomiar wykonywany w oknie aplikacji. root = kontener (strona lub okienko).
const measure=rootSelector=>`(()=>{
 const root=document.querySelector(${JSON.stringify(rootSelector)});if(!root)return null
 const visible=el=>{const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'&&Number(cs.opacity)>0.05}
 const own=el=>[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('')
 const label=el=>el.tagName.toLowerCase()+'.'+String(el.className||'').toString().split(' ')[0]+'「'+own(el).trim().slice(0,40)+'」'
 const texts=[...root.querySelectorAll('*')].filter(el=>own(el).trim()&&visible(el)&&!el.closest('svg,[aria-hidden="true"],.visuallyHidden'))
 const tiny=[],clipped=[],proportional=[],badMoney=[],spill=[]
 // Karty/przyciski, z których treść wystaje (overflow: visible, a treść wyższa niż ramka)
 for(const el of root.querySelectorAll('button,[class*="Card"],[class*="card"]')){
  if(!visible(el)||el.closest('svg'))continue
  const cs=getComputedStyle(el)
  if(cs.overflowY==='visible'&&el.scrollHeight>el.clientHeight+3&&el.clientHeight>20)spill.push(label(el)+' '+el.scrollHeight+'>'+el.clientHeight)
 }
 for(const el of texts){
  const cs=getComputedStyle(el),size=parseFloat(cs.fontSize)
  if(size<10.95)tiny.push(size.toFixed(1)+'px '+label(el))
  if(el.scrollWidth>el.clientWidth+1&&['hidden','clip'].includes(cs.overflowX)&&cs.textOverflow!=='ellipsis')clipped.push(label(el))
  const money=own(el).match(/-?\\d[\\d\\s\\u00a0\\u202f.,]*\\s?zł/)
  if(money){
   if(!/tabular-nums/.test(cs.fontVariantNumeric))proportional.push(label(el))
   // Brak odstępu tysięcy: 4+ cyfry z rzędu przed „zł” lub przecinkiem
   if(/\\d{4,}(?:[.,]\\d{1,2})?\\s?zł/.test(money[0]))badMoney.push(label(el))
  }
 }
 // Sąsiednie karty/przyciski nachodzące na siebie (np. zbyt niskie wiersze siatki)
 const overlap=[]
 for(const parent of new Set([...root.querySelectorAll('button')].map(b=>b.parentElement))){
  const items=[...parent.children].filter(el=>el.tagName==='BUTTON'&&visible(el)&&getComputedStyle(el).position!=='absolute')
  if(items.length<2||items.length>80)continue
  const rects=items.map(el=>el.getBoundingClientRect())
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
   const a=rects[i],b=rects[j],w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)
   if(w>3&&h>3)overlap.push(label(items[i])+' ↔ '+label(items[j]))
  }
 }
 const box=root.getBoundingClientRect()
 const overflow=root===document.body||root.classList.contains('pageBody')?document.documentElement.scrollWidth>innerWidth+1:(root.scrollWidth>root.clientWidth+1&&getComputedStyle(root).overflowX!=='auto'&&getComputedStyle(root).overflowX!=='scroll')||box.right>innerWidth+1
 const uniq=a=>[...new Set(a)].slice(0,6)
 return{texts:texts.length,overflow,tiny:uniq(tiny),clipped:uniq(clipped),proportional:uniq(proportional),badMoney:uniq(badMoney),spill:uniq(spill),overlap:uniq(overlap)}
})()`

module.exports={measure}
