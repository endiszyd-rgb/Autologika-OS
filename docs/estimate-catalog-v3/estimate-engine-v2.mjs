/** AutoLogika preliminary quoting engine v2. No OEM hours. Values in PLN cents. */
export const DIFFICULTIES = Object.freeze({
  CORRODED_FASTENERS: {label:'Korozja połączeń', maxMinutes:60},
  SEIZED_BOLT: {label:'Usuwanie urwanej/zapieczonej śruby', maxMinutes:150},
  RESTRICTED_ACCESS: {label:'Utrudniony dostęp', maxMinutes:90},
  CUTTING_HEAT: {label:'Cięcie/podgrzewanie', maxMinutes:60},
  THREAD_REPAIR: {label:'Naprawa gwintu', maxMinutes:120},
  EXTRA_DISASSEMBLY: {label:'Dodatkowy demontaż', maxMinutes:180},
});
const nonnegInt=(n,name)=>{if(!Number.isSafeInteger(n)||n<0)throw new Error(`${name} must be a nonnegative integer`);return n};
const roundDiv=(n,d)=>Math.round(n/d);
/** rates are cents per 60min. baseMinutes needs confirmed workshop/manual/OEM source. */
export function calculateEstimate({baseMinutes, laborRateCentsPerHour, parts=[], materials=[], difficulties=[], taxBps=2300, overlaps=[]}) {
  nonnegInt(baseMinutes,'baseMinutes'); nonnegInt(laborRateCentsPerHour,'laborRateCentsPerHour'); nonnegInt(taxBps,'taxBps');
  if(taxBps>10000)throw Error('Tax rate not supported');
  const itemTotal = (items,kind)=>items.reduce((s,x)=>{
    nonnegInt(x.unitPriceCents,`${kind} unitPriceCents`);nonnegInt(x.quantity,`${kind} quantity`);
    return s+x.unitPriceCents*x.quantity;
  },0);
  const seen=new Set(); let extraMinutes=0;
  for(const d of difficulties){
    const preset=DIFFICULTIES[d.code]; if(!preset)throw Error('Unknown difficulty: '+d.code);
    if(seen.has(d.code))throw Error('Duplicated difficulty: '+d.code);seen.add(d.code);
    nonnegInt(d.minutes,'difficulty minutes');
    if(!d.minutes||d.minutes>preset.maxMinutes)throw Error('Difficulty minutes require separate estimate review');
    if(!d.reason?.trim()||!d.mechanicId||!d.evidenceId||d.approvedByCustomer!==true)throw Error('Additional work needs evidence, technician and customer acceptance');
    extraMinutes+=d.minutes;
  }
  // Overlaps may only come from verified job-specific rule or an OEM provider result, not from inferred deduction.
  let overlapMinutes=0;
  for(const o of overlaps){
    nonnegInt(o.minutes,'overlap minutes');
    if(!['verified_workshop_rule','licensed_provider'].includes(o.source)||!o.referenceId)throw Error('Unverified overlap adjustment');
    overlapMinutes+=o.minutes;
  }
  if(overlapMinutes>baseMinutes)throw Error('Overlaps cannot exceed base work');
  const billableMinutes=baseMinutes-overlapMinutes+extraMinutes;
  const laborCents=roundDiv(billableMinutes*laborRateCentsPerHour,60);
  const partsCents=itemTotal(parts,'parts'); const materialsCents=itemTotal(materials,'materials');
  const netCents=laborCents+partsCents+materialsCents;
  const taxCents=roundDiv(netCents*taxBps,10000);
  return {baseMinutes,overlapMinutes,extraMinutes,billableMinutes,laborCents,partsCents,materialsCents,netCents,taxCents,grossCents:netCents+taxCents,preliminary:true,sourceNotice:'Czas ręczny lub potwierdzony. Ceny rynkowe nie są normami OEM.'};
}
export function validateQuoteInputs({vehicleConfirmed,workScopeConfirmed,baseTimeSource,partsVerified,customerApprovalRequired=false}){
 const errors=[];
 if(!vehicleConfirmed) errors.push('Zweryfikuj wariant pojazdu');
 if(!workScopeConfirmed) errors.push('Potwierdź zakres naprawy');
 if(!['workshop_history','technician_estimate','licensed_oem'].includes(baseTimeSource))errors.push('Brak dopuszczalnego źródła czasu');
 if(!partsVerified)errors.push('Ceny części wymagają potwierdzenia');
 if(customerApprovalRequired)errors.push('Oczekuje na akceptację prac dodatkowych');
 return {ready:errors.length===0,errors};
}