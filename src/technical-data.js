export const TECH_CATEGORIES=[
 ['TORQUE','Moment dokręcania'],['FLUID','Płyn / olej'],['CAPACITY','Ilość / pojemność'],['SPEC','Specyfikacja'],
 ['INTERVAL','Interwał'],['TOOL','Narzędzie / blokada'],['MEASUREMENT','Wartość kontrolna'],['TEMPERATURE','Temperatura procedury'],
 ['PRESSURE','Ciśnienie'],['ELECTRICAL','Wartość elektryczna'],['ADAPTATION','Adaptacja / nastawa'],['NOTE','Uwaga techniczna']
]
export const TECH_LABELS=Object.fromEntries(TECH_CATEGORIES)
export const SOURCE_TYPES=[['OEM','OEM / producent'],['LICENSED','Licencjonowana baza'],['MANUAL','Instrukcja części / urządzenia'],['WORKSHOP','Wiedza warsztatu'],['OTHER','Inne']]

const map=[
 [/olej|filtr oleju/i,['FLUID','CAPACITY','SPEC','TORQUE','INTERVAL']],
 [/hamul|klock|tarcz/i,['TORQUE','SPEC','MEASUREMENT','ADAPTATION']],
 [/rozrząd|łańcuch|pasek/i,['TORQUE','TOOL','SPEC','MEASUREMENT']],
 [/dsg|s-tronic|skrzyn|przekład/i,['FLUID','CAPACITY','SPEC','TEMPERATURE','TORQUE','ADAPTATION']],
 [/haldex|4x4|awd/i,['FLUID','CAPACITY','SPEC','TORQUE','ADAPTATION']],
 [/chłodz|termostat|pompa wody/i,['FLUID','CAPACITY','SPEC','TORQUE','TEMPERATURE']],
 [/wtrysk|paliw|common rail/i,['TORQUE','PRESSURE','SPEC','ADAPTATION','MEASUREMENT']],
 [/turbo|doładow/i,['TORQUE','PRESSURE','SPEC','MEASUREMENT']],
 [/zawies|wahacz|amort|łożysk|piast/i,['TORQUE','MEASUREMENT','SPEC']],
 [/świec|zapłon/i,['TORQUE','SPEC','MEASUREMENT']],
 [/akumulator|alternator|rozrusz|elektr|can|lin/i,['ELECTRICAL','MEASUREMENT','SPEC','ADAPTATION']],
 [/adas|radar|kamera/i,['MEASUREMENT','TOOL','ADAPTATION','SPEC']],
 [/klimatyz/i,['FLUID','CAPACITY','SPEC','PRESSURE','TEMPERATURE']],
]
export function relevantTechnical(entries=[],text=''){
 const hay=String(text||'').toLowerCase();
 const tagged=entries.filter(x=>String(x.work_tags||'').toLowerCase().split(/[,;]+/).map(t=>t.trim()).filter(Boolean).some(t=>hay.includes(t)||t.split(/\s+/).some(w=>w.length>3&&hay.includes(w))));
 const hit=map.find(([re])=>re.test(text)); if(!hit)return tagged.length?[...tagged,...entries.filter(x=>!tagged.includes(x))]:entries
 const wanted=new Set(hit[1]); const selected=entries.filter(x=>wanted.has(x.category)||x.category==='NOTE');
 const merged=[...tagged,...selected.filter(x=>!tagged.includes(x))];
 return merged.length?merged:entries
}
export function techValue(x){return [x.value,x.unit].filter(Boolean).join(' ')}

export const VERIFICATION_LEVELS={
 OEM_VERIFIED:'OEM VERIFIED',
 VERIFIED:'VERIFIED',
 CORROBORATED_SECONDARY:'POTWIERDZONE — ŹRÓDŁO WTÓRNE',
 WORKSHOP:'WORKSHOP',
 UNVERIFIED:'UNVERIFIED'
}
export function verificationLabel(x){return VERIFICATION_LEVELS[x?.verification_level]|| (x?.verified?'VERIFIED':'UNVERIFIED')}

