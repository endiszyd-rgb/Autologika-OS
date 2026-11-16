const test=require('node:test')
const assert=require('node:assert/strict')
const {formatMoney,formatQuantity}=require('../shared/money-format.cjs')
const plain=value=>value.replace(/[  ]/g,' ')

test('printed amounts group thousands and use a decimal comma',()=>{
 assert.equal(plain(formatMoney(12999.99)),'12 999,99 zł')
 assert.equal(plain(formatMoney(4860)),'4 860,00 zł')
 assert.equal(plain(formatMoney('380')),'380,00 zł')
 assert.equal(plain(formatMoney(null)),'0,00 zł')
 assert.equal(plain(formatQuantity(1500)),'1 500')
 assert.equal(formatQuantity(1.5),'1,5')
})

test('protocol PDF uses the same amount format',()=>{
 const {money}=require('../electron/protocol-document.cjs')
 assert.equal(plain(money(12999.99)),'12 999,99 zł')
})
