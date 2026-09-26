function timestamp(value){const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:0}

function plural(value,forms){const n=Math.abs(Math.trunc(value)),lastTwo=n%100,last=n%10;return n===1?forms[0]:last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?forms[1]:forms[2]}

export function approvalLinkState(approval,now=Date.now()){
 const storedStatus=String(approval?.status||'').toUpperCase(),expiresAt=timestamp(approval?.remote_expires_at),remainingMs=expiresAt-now
 const status=storedStatus==='PENDING'&&expiresAt&&remainingMs<=0?'EXPIRED':storedStatus
 let relative=''
 if(expiresAt){const totalMinutes=Math.max(0,Math.ceil(Math.abs(remainingMs)/60000)),days=Math.floor(totalMinutes/1440),hours=Math.floor(totalMinutes/60);const amount=days>=1?days:hours>=1?hours:totalMinutes,unit=days>=1?plural(amount,['dzień','dni','dni']):hours>=1?plural(amount,['godzina','godziny','godzin']):plural(amount,['minuta','minuty','minut']);relative=remainingMs>0?`Wygasa za ${amount} ${unit}`:`Wygasł ${amount} ${unit} temu`}
 return{status,storedStatus,expiresAt,remainingMs,relative,active:status==='PENDING'&&remainingMs>0,expiringSoon:status==='PENDING'&&remainingMs>0&&remainingMs<=24*60*60*1000,hasRemoteLink:!!approval?.remote_id}
}

export function approvalEventMatches(event,approval,orderId){
 const eventApproval=Number(event?.approvalId),currentApproval=Number(approval?.id),eventOrder=Number(event?.orderId),currentOrder=Number(orderId)
 return(Number.isFinite(eventApproval)&&eventApproval>0&&eventApproval===currentApproval)||(Number.isFinite(eventOrder)&&eventOrder>0&&eventOrder===currentOrder)
}
