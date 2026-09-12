const {spawnSync}=require('node:child_process')
const electron=require('electron')
const path=require('node:path')
const env={...process.env}
delete env.ELECTRON_RUN_AS_NODE
const script=process.argv[2]||'migration-smoke.cjs'
const result=spawnSync(electron,[path.join(__dirname,script),...process.argv.slice(3)],{env,stdio:'inherit'})
process.exit(result.status??1)
