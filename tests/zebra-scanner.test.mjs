import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeScan,createKeyboardWedge,parseZebraSdkXml} from '../src/zebra-scanner.js'

test('Zebra BarcodeEvent XML preserves RAW bytes and extracts VIN',()=>{
 const vin='WVWZZZ1JZXW000001'
 const raw=[...new TextEncoder().encode(vin)].map(x=>`0x${x.toString(16).padStart(2,'0')}`).join(' ')
 const xml=`<scandata><scannerID>1</scannerID><modelnumber>DS2208</modelnumber><serialnumber>TEST123</serialnumber><datatype>11</datatype><rawdata>${raw}</rawdata></scandata>`
 const parsed=parseZebraSdkXml(xml),scan=analyzeScan(xml)
 assert.equal(parsed.model,'DS2208')
 assert.equal(parsed.bytes.length,17)
 assert.equal(parsed.text,vin)
 assert.equal(scan.vin,vin)
 assert.equal(scan.byteLength,17)
})

test('scanner analysis distinguishes encoded AZTEC payload candidates',()=>{
 assert.equal(analyzeScan('G'.repeat(48)).kind,'BASE64')
 assert.equal(analyzeScan('10FF'.repeat(20)).kind,'HEX')
})

test('global scanner captures an AZTEC payload from an input and restores its previous value',()=>{
 let handler,scanned='',prevented=false
 const previous={window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLTextAreaElement:globalThis.HTMLTextAreaElement,Event:globalThis.Event}
 const prototype={};Object.defineProperty(prototype,'value',{get(){return this._value||''},set(value){this._value=String(value)}})
 globalThis.window={addEventListener:(_name,fn)=>{handler=fn},removeEventListener:()=>{}}
 globalThis.HTMLInputElement={prototype};globalThis.HTMLTextAreaElement={prototype}
 globalThis.Event=class{constructor(type,options){this.type=type;this.bubbles=options?.bubbles}}
 const input=Object.create(prototype);Object.assign(input,{tagName:'INPUT',value:'Jan Kowalski',selectionStart:12,selectionEnd:12,dispatchEvent:()=>{},setSelectionRange:()=>{}})
 const cleanup=createKeyboardWedge({onScan:value=>{scanned=value},minLength:40,captureEditable:true})
 const payload='A'.repeat(80)
 for(const key of payload){handler({key,target:input,preventDefault(){},stopPropagation(){}});input.value+=key}
 handler({key:'Enter',target:input,preventDefault(){prevented=true},stopPropagation(){}})
 assert.equal(scanned,payload)
 assert.equal(input.value,'Jan Kowalski')
 assert.equal(prevented,true)
 cleanup()
 Object.assign(globalThis,previous)
})
