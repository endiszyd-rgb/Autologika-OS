export function bytesToBase64(bytes){
 const source=bytes instanceof Uint8Array?bytes:Uint8Array.from(bytes||[])
 let binary=''
 for(let offset=0;offset<source.length;offset+=0x8000)binary+=String.fromCharCode(...source.subarray(offset,offset+0x8000))
 return globalThis.btoa(binary)
}

export function cameraErrorMessage(error){
 const name=String(error?.name||''),message=String(error?.message||error||'')
 if(name==='NotAllowedError'||/permission|denied|not allowed/i.test(message))return 'Safari nie ma dostępu do aparatu. W ustawieniach witryny zezwól AutoLogice na używanie aparatu.'
 if(name==='NotFoundError'||name==='DevicesNotFoundError')return 'Nie znaleziono tylnego aparatu. Możesz wybrać zdjęcie dokumentu z biblioteki.'
 if(name==='NotReadableError'||/could not start|track start/i.test(message))return 'Aparat jest używany przez inną aplikację. Zamknij ją i spróbuj ponownie.'
 if(!globalThis.isSecureContext)return 'Aparat w iOS działa tylko przez bezpieczne połączenie HTTPS.'
 return `Nie udało się uruchomić skanera: ${message||'nieznany błąd aparatu'}`
}
