import parser from '../../shared/delivery-document-parser.cjs'
export const parseDeliveryDocument=parser.parseDeliveryDocument
export async function recognizeDeliveryPhoto(file,{signal,onProgress=()=>{}}={}){
 if(!file||file.type==='application/pdf'||/\.pdf$/i.test(file.name))throw new Error('Do odczytu części wybierz zdjęcie dokumentu. PDF możesz zapisać jako plik.')
 const url=URL.createObjectURL(file);let worker
 const check=()=>{if(signal?.aborted)throw new DOMException('Anulowano odczyt','AbortError')}
 const abort=()=>worker?.terminate()
 try{
  const image=new Image();image.src=url;await image.decode();check()
  const factor=Math.min(1,2800/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*factor);canvas.height=Math.round(image.naturalHeight*factor)
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height)
  const {createWorker}=await import('tesseract.js');check()
  const base=new URL('ocr/',new URL(import.meta.env.BASE_URL,location.href)).href
  worker=await createWorker('pol',1,{workerPath:base+'worker.min.js',corePath:base+'tesseract-core-lstm.wasm.js',langPath:base,gzip:true,logger:message=>onProgress({status:message.status,progress:message.progress||0})});check()
  signal?.addEventListener('abort',abort,{once:true})
  await worker.setParameters({preserve_interword_spaces:'1'});const result=await worker.recognize(canvas,{rotateAuto:true},{text:true});check()
  return {...parseDeliveryDocument(result.data.text),ocr_confidence:result.data.confidence}
 }finally{signal?.removeEventListener('abort',abort);if(worker)await worker.terminate().catch(()=>{});URL.revokeObjectURL(url)}
}
