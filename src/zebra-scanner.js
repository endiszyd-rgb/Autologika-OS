export const normalizeScan=s=>String(s||'').replace(/[\r\n]+$/,'')
const bytesToHex=b=>Array.from(b||[]).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()
const bytesToText=b=>{try{return new TextDecoder('utf-8',{fatal:false}).decode(Uint8Array.from(b||[]))}catch{return ''}}
export function parseZebraSdkXml(xml){
 const src=String(xml||''); if(!/<scandata[\s>]/i.test(src))return null
 const val=t=>{const m=src.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`,'i'));return m?m[1].trim():''}
 const raw=val('rawdata')||val('datalabel'); const nums=[...raw.matchAll(/0x([0-9a-f]{1,2})/ig)].map(m=>parseInt(m[1],16))
 const text=bytesToText(nums)
 return {source:'ZEBRA_SDK',scannerId:val('scannerID'),model:val('modelnumber'),serial:val('serialnumber'),datatype:val('datatype'),bytes:nums,hex:bytesToHex(nums),text,xml:src}
}
export function analyzeScan(raw){
 const sdk=parseZebraSdkXml(raw); const text=normalizeScan(sdk?.text||raw), compact=text.replace(/\s+/g,'')
 const vin=(text.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/)||[])[0]||''
 const base64=/^[A-Za-z0-9+/=_-]{40,}$/.test(compact), hex=/^(?:[0-9A-Fa-f]{2}){20,}$/.test(compact)
 return {raw:text,original:String(raw||''),length:text.length,byteLength:sdk?.bytes?.length||0,vin,kind:vin?'VIN':sdk?'ZEBRA/SNAPI':hex?'HEX':base64?'BASE64':'AZTEC/TEXT',capturedAt:new Date().toISOString(),sdk}
}
export function createKeyboardWedge({onScan,timeout=90,minLength=4,captureEditable=false}={}){
 let buffer='',last=0,timer=null,target=null,startValue='',startSelectionStart=null,startSelectionEnd=null
 const editable=node=>{const tag=String(node?.tagName||'').toLowerCase();return Boolean(node?.isContentEditable||['input','textarea'].includes(tag))}
 const reset=()=>{buffer='';target=null;startValue='';startSelectionStart=null;startSelectionEnd=null;clearTimeout(timer);timer=null}
 const restore=()=>{if(!editable(target)||target.isContentEditable)return;const proto=target.tagName.toLowerCase()==='textarea'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(target,startValue);target.dispatchEvent(new Event('input',{bubbles:true}));try{target.setSelectionRange(startSelectionStart??startValue.length,startSelectionEnd??startValue.length)}catch{}}
 const flush=(rollback=false)=>{const v=buffer;if(v.length>=minLength){if(rollback)restore();onScan?.(v)}reset()}
 const handler=e=>{if(e.ctrlKey||e.altKey||e.metaKey)return;const isEditable=editable(e.target);if(isEditable&&!captureEditable)return;const now=performance.now();if((last&&now-last>timeout*2)||(target&&target!==e.target))reset();last=now;if(!buffer){target=e.target;startValue=String(e.target?.value||'');startSelectionStart=e.target?.selectionStart;startSelectionEnd=e.target?.selectionEnd}if(e.key==='Enter'||e.key==='Tab'){if(buffer.length>=minLength){e.preventDefault();e.stopPropagation();flush(isEditable)}else reset();return}if(e.key.length===1){buffer+=e.key;clearTimeout(timer);if(!isEditable)timer=setTimeout(()=>flush(false),timeout)}}
 window.addEventListener('keydown',handler,true);return()=>{window.removeEventListener('keydown',handler,true);clearTimeout(timer)}
}
