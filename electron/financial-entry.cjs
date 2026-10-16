const PAYMENT_METHODS=['GOTOWKA','KARTA','PRZELEW','BLIK','INNA']
const APPROVAL_STATUSES=['PENDING','APPROVED','DECLINED']
const APPROVAL_CHANNELS=['TELEFON','SMS','EMAIL','OSOBISCIE']

function moneyValue(value,{allowZero=false,label='Kwota'}={}){
  if(value===null||value===undefined||String(value).trim()==='')throw new Error(`${label} jest wymagana.`)
  const amount=Number(value)
  if(!Number.isFinite(amount)||amount<0||(!allowZero&&amount===0)||amount>100000000){
    throw new Error(`${label} musi być ${allowZero?'nieujemną':'dodatnią'} kwotą do 100 000 000 zł.`)
  }
  return Math.round(amount*100)/100
}

function normalizeChoice(value,allowed,fallback,label){
  const normalized=String(value||fallback).trim().toUpperCase()
  if(!allowed.includes(normalized))throw new Error(`Nieprawidłowa wartość pola „${label}”.`)
  return normalized
}

function paymentEntry(data={}){
  return{
    amount:moneyValue(data.amount,{label:'Kwota płatności'}),
    method:normalizeChoice(data.method,PAYMENT_METHODS,'GOTOWKA','forma płatności'),
    reference:String(data.reference||'').trim(),
    note:String(data.note||'').trim()
  }
}

function approvalEntry(data={}){
  const scope=String(data.scope||'').trim()
  if(!scope)throw new Error('Podaj zakres akceptacji klienta.')
  return{
    status:normalizeChoice(data.status,APPROVAL_STATUSES,'PENDING','status akceptacji'),
    amount:moneyValue(data.amount,{allowZero:true,label:'Kwota akceptacji'}),
    scope,
    channel:normalizeChoice(data.channel,APPROVAL_CHANNELS,'TELEFON','kanał akceptacji'),
    note:String(data.note||'').trim()
  }
}

function approvalDecision(value){
  const status=normalizeChoice(value,APPROVAL_STATUSES,'','status decyzji')
  if(status==='PENDING')throw new Error('Decyzja klienta musi oznaczać akceptację albo odrzucenie.')
  return status
}

function assertApprovalPending(value){
  const current=normalizeChoice(value,APPROVAL_STATUSES,'','bieżący status akceptacji')
  if(current!=='PENDING')throw new Error('Decyzja klienta została już zapisana i nie może zostać nadpisana.')
  return true
}

module.exports={APPROVAL_CHANNELS,APPROVAL_STATUSES,PAYMENT_METHODS,approvalDecision,approvalEntry,assertApprovalPending,moneyValue,paymentEntry}
