function decodeEntities(value){
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}
  return String(value||'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_match,entity)=>{
    if(entity[0]==='#'){
      const hex=entity[1]?.toLowerCase()==='x'
      const code=Number.parseInt(entity.slice(hex?2:1),hex?16:10)
      return Number.isFinite(code)?String.fromCodePoint(code):''
    }
    return named[entity.toLowerCase()]??''
  })
}

function htmlToText(value){
  return decodeEntities(String(value||'')
    .replace(/<\s*li[^>]*>/gi,'• ')
    .replace(/<\s*\/\s*li\s*>/gi,'\n')
    .replace(/<\s*br\s*\/?>/gi,'\n')
    .replace(/<\s*\/\s*(p|div|ul|ol|h[1-6])\s*>/gi,'\n')
    .replace(/<[^>]+>/g,''))
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim()
}

function notesText(notes){
  const joined=Array.isArray(notes)?notes.map(x=>typeof x==='string'?x:x?.note||'').filter(Boolean).join('\n\n'):String(notes||'')
  return htmlToText(joined)
}

module.exports={decodeEntities,htmlToText,notesText}
