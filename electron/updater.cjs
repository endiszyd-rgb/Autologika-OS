const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const packageInfo = require('../package.json')
const { resolveUpdateRepository } = require('./update-repository.cjs')
const { notesText } = require('./release-notes.cjs')

const repository = resolveUpdateRepository(packageInfo)
const configured = Boolean(repository.owner&&repository.repo&&!repository.owner.includes('GITHUB_OWNER')&&!repository.repo.includes('GITHUB_REPO'))
const stateFile = () => path.join(app.getPath('userData'),'updater-state.json')
const logFile = () => path.join(app.getPath('userData'),'logs','updater.log')
let autoUpdater=null
let initialized=false
let prepareInstall=null
let status={state:'IDLE',currentVersion:'',availableVersion:'',channel:'STABLE',percent:0,lastChecked:'',releaseNotes:'',message:'',configured,canCheck:false,canDownload:false,canInstall:false}
const currentVersion = () => app.isPackaged?app.getVersion():packageInfo.version

function sanitize(value){return String(value?.stack||value?.message||value||'').replace(/(token|authorization|password|secret|key)=?[^\s&]+/gi,'$1=[REDACTED]').slice(0,4000)}
function log(event,details=''){
  try{const file=logFile();fs.mkdirSync(path.dirname(file),{recursive:true});fs.appendFileSync(file,`${new Date().toISOString()} ${event}${details?` ${sanitize(details)}`:''}\n`,'utf8')}catch{}
}
function readSavedState(){try{return JSON.parse(fs.readFileSync(stateFile(),'utf8'))||{}}catch{return {}}}
function persist(){try{fs.writeFileSync(stateFile(),JSON.stringify({lastChecked:status.lastChecked,channel:status.channel},null,2),'utf8')}catch{}}
function notify(patch={}){
  status={...status,...patch,currentVersion:currentVersion(),configured}
  for(const win of BrowserWindow.getAllWindows())if(!win.isDestroyed())win.webContents.send('updater:status',status)
  return status
}
function unavailable(message){return notify({state:'IDLE',message,canCheck:false,canDownload:false,canInstall:false})}

function init(options={}){
  if(initialized)return status
  initialized=true;prepareInstall=options.prepareInstall||null
  const saved=readSavedState()
  status={...status,currentVersion:currentVersion(),lastChecked:saved.lastChecked||'',channel:saved.channel==='BETA'?'BETA':'STABLE'}
  if(!app.isPackaged)return unavailable('Aktualizacje są wyłączone w trybie developerskim.')
  if(!configured)return unavailable('Serwer aktualizacji nie został jeszcze skonfigurowany.')
  const electronUpdater=require('electron-updater')
  autoUpdater=electronUpdater.autoUpdater
  autoUpdater.setFeedURL({provider:'github',owner:repository.owner,repo:repository.repo})
  autoUpdater.autoDownload=false
  autoUpdater.autoInstallOnAppQuit=false
  autoUpdater.allowDowngrade=false
  autoUpdater.allowPrerelease=status.channel==='BETA'
  autoUpdater.channel=status.channel==='BETA'?'beta':'latest'
  autoUpdater.logger={info:m=>log('INFO',m),warn:m=>log('WARN',m),error:m=>log('ERROR',m),debug:m=>log('DEBUG',m)}
  autoUpdater.on('checking-for-update',()=>{log('CHECK');notify({state:'CHECKING',message:'Sprawdzanie dostępności nowej wersji…',percent:0,canCheck:false,canDownload:false,canInstall:false})})
  autoUpdater.on('update-available',info=>{log('AVAILABLE',info.version);notify({state:'UPDATE_AVAILABLE',availableVersion:info.version,releaseNotes:notesText(info.releaseNotes),message:`Dostępna jest wersja ${info.version}.`,canCheck:true,canDownload:true,canInstall:false})})
  autoUpdater.on('update-not-available',info=>{status.lastChecked=new Date().toISOString();persist();log('NO UPDATE',info?.version||'');notify({state:'NO_UPDATE',availableVersion:'',releaseNotes:'',message:'Masz najnowszą wersję programu.',canCheck:true,canDownload:false,canInstall:false})})
  autoUpdater.on('download-progress',progress=>{const percent=Math.max(0,Math.min(100,Number(progress.percent||0)));log('DOWNLOAD PROGRESS',percent.toFixed(1));notify({state:'DOWNLOADING',percent,message:`Pobieranie aktualizacji: ${Math.round(percent)}%`,canCheck:false,canDownload:false,canInstall:false})})
  autoUpdater.on('update-downloaded',info=>{status.lastChecked=new Date().toISOString();persist();log('DOWNLOADED',info.version);notify({state:'DOWNLOADED',availableVersion:info.version,releaseNotes:notesText(info.releaseNotes)||status.releaseNotes,percent:100,message:`Aktualizacja ${info.version} jest gotowa.`,canCheck:true,canDownload:false,canInstall:true})})
  autoUpdater.on('error',error=>{status.lastChecked=new Date().toISOString();persist();log('ERROR',error);notify({state:'ERROR',message:'Nie udało się połączyć z serwerem aktualizacji. Program nadal działa offline.',canCheck:true,canDownload:false,canInstall:false})})
  notify({canCheck:true,message:'Aktualizacje są gotowe do sprawdzania.'})
  setTimeout(()=>check({silent:true}),15000).unref?.()
  return status
}

async function check({silent=false}={}){
  if(!initialized)init()
  if(!autoUpdater)return status
  try{status.lastChecked=new Date().toISOString();persist();await autoUpdater.checkForUpdates();return status}catch(error){log('ERROR',error);if(!silent)notify({state:'ERROR',message:'Nie udało się sprawdzić aktualizacji. Sprawdź internet i spróbuj ponownie.',canCheck:true});return status}
}
async function download(){
  if(!autoUpdater||status.state!=='UPDATE_AVAILABLE')return notify({message:'Najpierw sprawdź, czy jest dostępna aktualizacja.'})
  log('DOWNLOAD START',status.availableVersion);notify({state:'DOWNLOADING',percent:0,message:'Rozpoczynam pobieranie…',canCheck:false,canDownload:false})
  try{await autoUpdater.downloadUpdate();return status}catch(error){log('ERROR',error);return notify({state:'ERROR',message:'Pobieranie aktualizacji nie powiodło się. Możesz spróbować ponownie.',canCheck:true,canDownload:false})}
}
async function install(){
  if(!autoUpdater||status.state!=='DOWNLOADED')return{ok:false,error:'Aktualizacja nie jest jeszcze pobrana.'}
  try{
    log('BACKUP START',`${currentVersion()} -> ${status.availableVersion}`)
    const backup=await prepareInstall?.({currentVersion:currentVersion(),targetVersion:status.availableVersion})
    if(!backup?.file)throw new Error('Nie otrzymano potwierdzenia utworzenia backupu.')
    log('BACKUP OK',backup.file)
    log('INSTALL',status.availableVersion)
    notify({message:'Backup gotowy. Instalowanie aktualizacji…',canInstall:false})
    setImmediate(()=>autoUpdater.quitAndInstall(false,true))
    return{ok:true,backup}
  }catch(error){log('ERROR',error);notify({state:'ERROR',message:`Aktualizacja nie została zainstalowana: ${sanitize(error)}`,canCheck:true,canInstall:true});return{ok:false,error:sanitize(error)}}
}

function setChannel(channel){
  const next=String(channel).toUpperCase()==='BETA'?'BETA':'STABLE'
  status.channel=next;persist()
  if(autoUpdater){autoUpdater.allowPrerelease=next==='BETA';autoUpdater.channel=next==='BETA'?'beta':'latest'}
  log('CHANNEL',next)
  return notify({channel:next,state:'IDLE',availableVersion:'',releaseNotes:'',percent:0,message:next==='BETA'?'Kanał beta włączony. Możesz sprawdzić wersje testowe.':'Kanał stabilny włączony.',canCheck:Boolean(autoUpdater),canDownload:false,canInstall:false})
}

module.exports={init,getStatus:()=>({...status,currentVersion:currentVersion()}),check,download,install,setChannel,log,logPath:logFile,repositoryConfigured:()=>configured}
