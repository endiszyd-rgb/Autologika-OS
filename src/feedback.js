export function notifyFeedback(title,detail='',tone='success'){
 if(typeof window==='undefined')return
 window.dispatchEvent(new CustomEvent('autologika:feedback',{detail:{id:Date.now(),title:String(title||''),detail:String(detail||''),tone}}))
}
