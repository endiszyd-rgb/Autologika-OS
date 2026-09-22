const hasText=value=>Boolean(String(value||'').trim())

export const hasBasicDiagnosis=diagnosis=>['symptom_confirmed','conclusion','recommendation'].some(key=>hasText(diagnosis?.[key]))

export function deriveOrderAdvice({order={},diagnosis,items=[],parts=[],approvals=[],payments=[],qcRows=[],logs=[],procedures=[]}={}){
  const latestApproval=approvals.reduce((latest,item)=>!latest||Number(item.id||0)>Number(latest.id||0)?item:latest,null)
  const approved=latestApproval?.status==='APPROVED'
  const pending=latestApproval?.status==='PENDING'
  const openParts=parts.filter(item=>!['ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE'].includes(item.status))
  const hasWorkScope=items.length>0||procedures.length>0
  const workLogged=logs.some(item=>Boolean(item.ended_at)||Number(item.duration_minutes)>0)
  const qcDone=qcRows.length>=8&&qcRows.filter(item=>item.checked).length>=8
  const paid=payments.reduce((sum,item)=>sum+Number(item.amount||0),0)
  const due=Math.max(0,Number(order.total||0)-paid)

  if(order.status==='PRZYJETE')return {title:'Przenieś do diagnozy',detail:'Auto jest przyjęte. Rozpocznij właściwy tok diagnostyczny.',status:'DIAGNOZA',wait:'BRAK'}
  if(order.status==='DIAGNOZA'&&!hasBasicDiagnosis(diagnosis))return {title:'Uzupełnij opis usterki',detail:'Krótki opis rozpoznanej usterki wystarczy, aby zamknąć podstawową diagnozę.',tab:'diagnosis'}
  if(order.status==='DIAGNOZA')return {title:'Przejdź do akceptacji',detail:'Diagnoza jest zapisana. Przygotuj zakres i uzyskaj decyzję klienta.',status:'AKCEPTACJA',wait:'DECYZJA',tab:'quote'}
  if(order.status==='AKCEPTACJA'&&!approved)return {title:pending?'Sprawdź decyzję klienta':'Zarejestruj akceptację klienta',detail:pending?'Akceptacja została wysłana i nadal jest oczekująca.':'Brak zatwierdzonego zakresu prac.',wait:'DECYZJA',tab:'quote'}
  if(order.status==='AKCEPTACJA'&&openParts.length)return {title:'Sprawdź zamówione części',detail:`Akceptacja jest zapisana. ${openParts.length} pozycji nadal wymaga dostawy.`,wait:'CZESCI',tab:'parts'}
  if(order.status==='AKCEPTACJA')return {title:'Rozpocznij naprawę',detail:'Zakres zaakceptowany i brak blokady części.',status:'NAPRAWA',wait:'BRAK',tab:'works'}
  if(order.status==='NAPRAWA'&&!hasWorkScope)return {title:'Dodaj zakres wykonanych prac',detail:'Zapisz co zostało wykonane, zanim przejdziesz do czasu pracy i kontroli jakości.',tab:'works'}
  if(order.status==='NAPRAWA'&&!workLogged)return {title:'Zarejestruj czas pracy',detail:'Zakres jest zapisany. Dodaj zakończony wpis czasu pracy.',tab:'time'}
  if(order.status==='NAPRAWA'&&!qcDone)return {title:'Wykonaj kontrolę jakości',detail:'Przed oznaczeniem auta jako gotowe potwierdź wszystkie punkty QC.',tab:'release'}
  if(order.status==='NAPRAWA')return {title:'Oznacz jako gotowe',detail:'Kontrola jakości jest zapisana. Auto może przejść do rozliczenia i wydania.',status:'GOTOWE',wait:'BRAK',tab:'settlement'}
  if(order.status==='GOTOWE'&&due>0.01)return {title:'Rozlicz zlecenie',detail:`Pozostało do zapłaty ${due.toLocaleString('pl-PL',{style:'currency',currency:'PLN',maximumFractionDigits:0})}.`,tab:'settlement'}
  if(order.status==='GOTOWE')return {title:'Uzupełnij wydanie pojazdu',detail:'Rozliczenie zamknięte. Sprawdź checklistę i zalecenia dla klienta.',tab:'release'}
  return {title:'Otwórz historię zlecenia',detail:'Zlecenie jest zakończone i dostępne do wglądu.',tab:'timeline'}
}
