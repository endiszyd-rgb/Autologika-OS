import {createPwaApi} from './pwa-api.js'

export const isElectron=()=>Boolean(window.autologika)

export function ensurePlatformApi(){
  if(window.autologika)return window.autologika
  const api=createPwaApi()
  Object.defineProperty(window,'autologika',{value:api,configurable:false,writable:false})
  return api
}
