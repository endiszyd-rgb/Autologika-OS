// iOS suspends timers in the background: refresh explicitly when it resumes.
export function startPwaSync(cloud,{window:win=window,document:doc=document,interval=30000}={}){
 const refresh=()=>{if(!doc.hidden&&cloud.authenticated&&cloud.online)cloud.sync(true).catch(()=>{})}
 const visibility=()=>{if(!doc.hidden)refresh()}
 const storage=event=>{if(event.key!=='autologika.pwa.session.v1')return;try{cloud.session=event.newValue?JSON.parse(event.newValue):null}catch{cloud.session=null};cloud.clear();cloud.emit({type:cloud.authenticated?'login':'logout'});refresh()}
 const timer=win.setInterval(refresh,interval)
 win.addEventListener('online',refresh);win.addEventListener('pageshow',refresh);win.addEventListener('focus',refresh);win.addEventListener('storage',storage);doc.addEventListener('visibilitychange',visibility)
 refresh()
 return()=>{win.clearInterval(timer);win.removeEventListener('online',refresh);win.removeEventListener('pageshow',refresh);win.removeEventListener('focus',refresh);win.removeEventListener('storage',storage);doc.removeEventListener('visibilitychange',visibility)}
}
