import test from 'node:test'
import assert from 'node:assert/strict'
import {contactPhone,orderContactMessage,smsLink} from '../src/platform/pwa-contact.mjs'
test('phone links preserve international numbers and reject multiple numbers or URI commands',()=>{
 assert.equal(contactPhone('+48 (799) 118-824'),'+48799118824')
 for(const value of ['', '123', '799118824;body=test','799118824,600700800','javascript:alert(1)'])assert.equal(contactPhone(value),'')
})
test('only a ready order offers a collection message',()=>{
 const order={id:12,make:'Skoda',model:'Fabia',plate:'ZPL 123',status:'GOTOWE'}
 assert.match(orderContactMessage(order),/gotowy do odbioru/);assert.match(orderContactMessage(order),/ZPL 123/)
 assert.doesNotMatch(orderContactMessage({...order,status:'NAPRAWA'}),/gotowy do odbioru/)
})
test('SMS drafts encode Polish text and use the platform body separator',()=>{
 assert.equal(smsLink('+48 799118824','Cześć & dzięki',true),'sms:+48799118824&body=Cze%C5%9B%C4%87%20%26%20dzi%C4%99ki')
 assert.equal(smsLink('799118824','Cześć',false),'sms:799118824?body=Cze%C5%9B%C4%87')
 assert.equal(smsLink('','text',true),'')
})
