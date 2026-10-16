const test=require('node:test')
const assert=require('node:assert/strict')
const {approvalDecision,approvalEntry,assertApprovalPending,moneyValue,paymentEntry}=require('../electron/financial-entry.cjs')

test('płatność wymaga dodatniej, skończonej kwoty i obsługiwanej formy',()=>{
 assert.deepEqual(paymentEntry({amount:'120.126',method:' karta ',reference:'  TX-1 ',note:' zapłacono '}),{amount:120.13,method:'KARTA',reference:'TX-1',note:'zapłacono'})
 for(const value of ['',0,-1,'abc',Infinity])assert.throws(()=>paymentEntry({amount:value}),/Kwota płatności/)
 assert.throws(()=>paymentEntry({amount:100,method:'KRYPTOWALUTA'}),/forma płatności/)
})

test('akceptacja klienta waliduje status, kanał, zakres i kwotę',()=>{
 assert.deepEqual(approvalEntry({status:' approved ',amount:0,scope:' Zakres naprawy ',channel:' sms '}),{status:'APPROVED',amount:0,scope:'Zakres naprawy',channel:'SMS',note:''})
 assert.throws(()=>approvalEntry({amount:100,scope:''}),/zakres akceptacji/)
 assert.throws(()=>approvalEntry({amount:-1,scope:'Naprawa'}),/Kwota akceptacji/)
 assert.throws(()=>approvalEntry({amount:100,scope:'Naprawa',status:'GOTOWE'}),/status akceptacji/)
 assert.throws(()=>approvalEntry({amount:100,scope:'Naprawa',channel:'WWW'}),/kanał akceptacji/)
})

test('rozstrzygnięcie akceptacji dopuszcza wyłącznie akceptację lub odrzucenie',()=>{
 assert.equal(approvalDecision('approved'),'APPROVED')
 assert.equal(approvalDecision(' DECLINED '),'DECLINED')
 assert.throws(()=>approvalDecision('PENDING'),/musi oznaczać/)
 assert.throws(()=>approvalDecision('GOTOWE'),/status decyzji/)
})

test('zapisanej decyzji klienta nie można nadpisać kolejną decyzją lokalną',()=>{
 assert.equal(assertApprovalPending('PENDING'),true)
 assert.throws(()=>assertApprovalPending('APPROVED'),/już zapisana/)
 assert.throws(()=>assertApprovalPending('DECLINED'),/już zapisana/)
})

test('normalizacja pieniędzy ogranicza wartość i zachowuje grosze',()=>{
 assert.equal(moneyValue('10.005',{label:'Cena'}),10.01)
 assert.equal(moneyValue(0,{allowZero:true}),0)
 assert.throws(()=>moneyValue(100000001),/100 000 000/)
})
