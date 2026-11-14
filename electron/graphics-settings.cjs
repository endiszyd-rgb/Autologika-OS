// Tryb grafiki aplikacji Windows.
// Domyślnie akceleracja GPU jest włączona (płynne animacje). Ustawienie trzymamy w pliku w userData,
// bo musi być znane przed app.ready — wtedy baza jeszcze nie jest otwarta.
// Tryb zgodności (renderowanie programowe) zostaje dostępny: ręcznie w Ustawieniach
// albo automatycznie po powtarzających się awariach procesu GPU.
const fs=require('node:fs')
const path=require('node:path')

const GRAPHICS_FILE='graphics-settings.json'
const GPU_FAILURE_REASONS=new Set(['crashed','abnormal-exit','launch-failed','integrity-failure','oom'])
const GPU_FAILURES_BEFORE_FALLBACK=2

const defaults=()=>({hardwareAcceleration:true,autoDisabled:false,reason:'',updatedAt:''})

function normalizeGraphics(value){
 const source=value&&typeof value==='object'?value:{}
 return{
  hardwareAcceleration:source.hardwareAcceleration!==false,
  autoDisabled:source.autoDisabled===true&&source.hardwareAcceleration===false,
  reason:String(source.reason||'').slice(0,200),
  updatedAt:String(source.updatedAt||'').slice(0,40)
 }
}

function readGraphics(dir){
 try{return normalizeGraphics(JSON.parse(fs.readFileSync(path.join(dir,GRAPHICS_FILE),'utf8')))}
 catch{return defaults()}
}

function writeGraphics(dir,value){
 const next={...normalizeGraphics(value),updatedAt:new Date().toISOString()}
 fs.mkdirSync(dir,{recursive:true})
 const target=path.join(dir,GRAPHICS_FILE),temp=`${target}.${process.pid}.tmp`
 fs.writeFileSync(temp,JSON.stringify(next))
 fs.renameSync(temp,target)
 return next
}

// Zmienna środowiskowa ma pierwszeństwo (diagnostyka / testy na maszynach bez GPU)
function shouldDisableGpu(settings,env=process.env){
 if(env.AUTOLOGIKA_DISABLE_GPU==='1')return true
 if(env.AUTOLOGIKA_DISABLE_GPU==='0')return false
 return settings.hardwareAcceleration===false
}

// Licznik awarii GPU w bieżącej sesji; po przekroczeniu progu zapisuje tryb zgodności na następne uruchomienie
function createGpuWatchdog(dir,{threshold=GPU_FAILURES_BEFORE_FALLBACK,log=()=>{}}={}){
 let failures=0
 return details=>{
  if(details?.type!=='GPU'||!GPU_FAILURE_REASONS.has(details.reason))return false
  failures++
  log(`GPU process gone: ${details.reason} (${failures}/${threshold})`)
  if(failures<threshold)return false
  const current=readGraphics(dir)
  if(current.hardwareAcceleration===false)return false
  writeGraphics(dir,{hardwareAcceleration:false,autoDisabled:true,reason:`Proces grafiki zakończył się awarią (${details.reason}).`})
  return true
 }
}

module.exports={GRAPHICS_FILE,normalizeGraphics,readGraphics,writeGraphics,shouldDisableGpu,createGpuWatchdog}
