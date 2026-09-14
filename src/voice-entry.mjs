const errorLabels={
 'not-allowed':'Brak dostępu do mikrofonu. Włącz go w ustawieniach systemu.',
 'service-not-allowed':'Usługa rozpoznawania mowy jest wyłączona.',
 'audio-capture':'Nie znaleziono działającego mikrofonu.',
 'network':'Rozpoznawanie mowy wymaga obecnie połączenia z internetem.',
 'no-speech':'Nie wykryto mowy. Spróbuj ponownie.',
 'language-not-supported':'Język polski nie jest dostępny w usłudze rozpoznawania.',
 aborted:''
}

function formatVoiceTranscript(value=''){
 return String(value)
  .replace(/\s+przecinek(?=\s|$)/gi,',')
  .replace(/\s+kropka(?=\s|$)/gi,'.')
  .replace(/\s+(?:nowa linia|nowy wiersz)(?=\s|$)/gi,'\n')
  .replace(/[ \t]+\n/g,'\n')
  .replace(/\n[ \t]+/g,'\n')
  .replace(/[ \t]{2,}/g,' ')
  .trim()
}

function joinVoiceText(base='',transcript=''){
 const left=String(base||'').trimEnd(),right=formatVoiceTranscript(transcript)
 if(!right)return left
 if(!left)return right.charAt(0).toUpperCase()+right.slice(1)
 const separator=left.endsWith('\n')?'':/[.!?:;,]$/.test(left)?' ':' '
 return `${left}${separator}${right}`
}

function collectSpeechResults(results=[]){
 let transcript='',final=true
 for(let index=0;index<results.length;index++){
  const result=results[index],part=result?.[0]?.transcript||''
  if(part)transcript+=`${transcript?' ':''}${part}`
  if(!result?.isFinal)final=false
 }
 return{transcript:formatVoiceTranscript(transcript),final}
}

function speechErrorMessage(code='unknown'){
 return Object.prototype.hasOwnProperty.call(errorLabels,code)?errorLabels[code]:'Nie udało się rozpoznać mowy. Spróbuj ponownie.'
}

export{collectSpeechResults,formatVoiceTranscript,joinVoiceText,speechErrorMessage}
