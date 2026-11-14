import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import halaSettings from '../../shared/hala-settings.cjs'
import {bayView,buildActions,buildBays,buildPulse,closedOn,easeOutCubic,greeting} from './hala-model.mjs'

const prefersReducedMotion=()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const EMPTY={layout:{bays:[],openingHour:8,closingHour:18},settings:halaSettings.normalizeHalaSettings(),orders:[],closed:[],appointments:[],active:[],attention:[]}
const POLL_MS=15000

// Count-up 0→1 przez requestAnimationFrame (odpowiednik `t` z makiety)
function useCountUp(duration=1500,ready=true){
 const[t,setT]=useState(()=>prefersReducedMotion()?1:0)
 useEffect(()=>{
  if(!ready)return
  if(prefersReducedMotion()){setT(1);return}
  let frame=0
  const start=performance.now()
  const tick=time=>{const progress=Math.min(1,(time-start)/duration);setT(easeOutCubic(progress));if(progress<1)frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick)
  return()=>cancelAnimationFrame(frame)
 },[duration,ready])
 return t
}

// Zegar przeskakuje równo z pełną minutą
function useMinuteClock(){
 const[now,setNow]=useState(()=>new Date())
 useEffect(()=>{
  let interval=0
  const timeout=setTimeout(()=>{setNow(new Date());interval=setInterval(()=>setNow(new Date()),60_000)},60_000-Date.now()%60_000)
  return()=>{clearTimeout(timeout);clearInterval(interval)}
 },[])
 return now
}

const settle=async(promise,fallback)=>{try{return await promise}catch{return fallback}}

export function useHala({api,labels={},refresh=0}={}){
 const[data,setData]=useState(EMPTY)
 const[state,setState]=useState({loading:true,error:'',updated:null})
 const[picked,setPicked]=useState(0)
 const sequence=useRef(0),polls=useRef(0),closedRef=useRef(null)
 const now=useMinuteClock()

 const load=useCallback(async(manual=false)=>{
  const id=++sequence.current
  // wydane dziś (obrót) liczymy rzadziej — lista archiwum bywa duża
  const withClosed=manual||closedRef.current===null||polls.current++%20===0
  if(manual)setState(current=>({...current,loading:true,error:''}))
  try{
   const from=new Date();from.setHours(0,0,0,0)
   const to=new Date(from);to.setDate(to.getDate()+8)
   // zlecenia i ustawienia są niezbędne; reszta ekranu działa nawet przy częściowej awarii
   const[layout,settings,orders,appointments,active,attention,released,archived]=await Promise.all([
    // stanowiska z ustawień warsztatu (synchronizowane; w PWA odczyt tylko na potrzeby Hali)
    settle((api.settings.halaLayout||api.settings.workshopLayout)(),EMPTY.layout),
    api.settings.hala(),
    api.orders.list(),
    settle(api.appointments.list(from.toISOString(),to.toISOString()),[]),
    settle(api.worklog.active(),[]),
    settle(api.notifications.list(),[]),
    withClosed?settle(api.orders.list('WYDANE'),[]):null,
    withClosed?settle(api.orders.list('ARCHIVE'),[]):null
   ])
   if(id!==sequence.current)return
   const bays=Array.isArray(layout?.bays)&&layout.bays.length?layout.bays:['Stanowisko 1','Stanowisko 2','Diagnostyka','Plac / oczekuje']
   setData({layout:{...layout,bays},settings,orders:(orders||[]).filter(row=>row.status!=='WYDANE'&&!row.archived_at),closed:withClosed?(closedRef.current=closedOn([...(released||[]),...(archived||[])],new Date())):closedRef.current,appointments:appointments||[],active:active||[],attention:attention||[]})
   setState({loading:false,error:'',updated:new Date()})
  }catch(error){
   if(id!==sequence.current)return
   console.error('Hala refresh failed',error)
   setState(current=>({...current,loading:false,error:'Nie udało się wczytać danych hali. Sprawdź połączenie i spróbuj ponownie.'}))
  }
 },[api])

 useEffect(()=>{
  load(true)
  const poll=()=>{if(!document.hidden)load(false)}
  const timer=setInterval(poll,POLL_MS)
  document.addEventListener('visibilitychange',poll)
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',poll);sequence.current++}
 },[load,refresh])

 const t=useCountUp(1500,Boolean(state.updated))
 const bays=useMemo(()=>buildBays({bayNames:data.layout.bays,settings:data.settings,orders:data.orders,appointments:data.appointments,active:data.active,labels,now}),[data,labels,now])
 const safePicked=Math.min(picked,Math.max(0,bays.length-1))
 const views=useMemo(()=>bays.map((bay,index)=>bayView(bay,{t,picked:index===safePicked})),[bays,t,safePicked])
 const hello=useMemo(()=>greeting({settings:data.settings,bays,orders:data.orders,closedToday:data.closed,now}),[data,bays,now])
 const actions=useMemo(()=>buildActions(data.attention,{now:now.getTime()}),[data.attention,now])
 const pulse=useMemo(()=>buildPulse({appointments:data.appointments,bayCount:data.layout.bays.length,openingHour:data.layout.openingHour,closingHour:data.layout.closingHour,now}),[data,now])

 // Przypisanie zlecenia do stanowiska (null = zwolnij); zapis od razu odświeża widok
 const assign=useCallback(async(bayName,order)=>{
  // świeży odczyt: ustawienia mogły zmienić się na innym urządzeniu od ostatniego odświeżenia
  const current=await settle(api.settings.hala(),data.settings)
  const next=halaSettings.assignBay(current,bayName,order)
  const saved=await api.settings.setHala(next)
  setData(current=>({...current,settings:saved||next}))
  load(false)
 },[api,data.settings,load])

 return{...state,bays:views,selected:views[safePicked]||null,picked:safePicked,pick:setPicked,t,now,hello,actions,attentionCount:data.attention.length,pulse,orders:data.orders,settings:data.settings,assign,reload:()=>load(true)}
}

// newsFeed: RSS + NBP, cache 1 h po stronie API (Electron: plik, PWA: localStorage)
export function useNewsFeed(api){
 const[feed,setFeed]=useState(null)
 const[state,setState]=useState({loading:true,error:''})
 const sequence=useRef(0)
 const load=useCallback(async(force=false)=>{
  const id=++sequence.current
  if(!api?.news?.feed){setState({loading:false,error:'Wiadomości są niedostępne w tej wersji aplikacji.'});return}
  setState(current=>({...current,loading:true,error:''}))
  try{const next=await api.news.feed({force});if(id!==sequence.current)return;setFeed(next);setState({loading:false,error:''})}
  catch(error){if(id!==sequence.current)return;console.error('News feed failed',error);setState({loading:false,error:'Nie udało się pobrać wiadomości. Pokażemy je po odzyskaniu połączenia.'})}
 },[api])
 useEffect(()=>{
  load(false)
  // co godzinę sprawdzamy cache; API samo zdecyduje, czy pobrać nowe dane
  const timer=setInterval(()=>{if(!document.hidden)load(false)},60*60*1000)
  return()=>clearInterval(timer)
 },[load])
 return{feed,...state,reload:()=>load(true)}
}
