const {spawn,spawnSync}=require('node:child_process')
const path=require('node:path')
const electron=require('electron')
const root=path.join(__dirname,'..'),url='http://127.0.0.1:4173'
const server=spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port','4173','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']})
let output='';server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk)
const wait=async()=>{for(let attempt=0;attempt<60;attempt++){try{const response=await fetch(url);if(response.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw new Error(`Serwer Vite Preview nie wystartował.\n${output}`)}
;(async()=>{try{await wait();const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const result=spawnSync(electron,[path.join(__dirname,'pwa-browser-smoke.cjs'),url],{cwd:root,env,stdio:'inherit',timeout:60000});if(result.error)throw result.error;process.exitCode=result.status??1}finally{server.kill()}})().catch(error=>{console.error(error);server.kill();process.exitCode=1})
