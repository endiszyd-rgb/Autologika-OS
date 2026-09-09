// AUTOLOGIKA 0.37 DEV — curated technical reference seed.
// Values below are deliberately source-scoped. They are NOT promoted to OEM_VERIFIED
// unless the source is an official OEM repair document matched to the vehicle/engine.

const AVQ_SOURCE='https://www.vwmanual.ru/pl/golf/5/power/engine/zubchatyy-remen-ustanovka-dizelnye-dvigateli-1-9'
const AVQ_DRIVE_SOURCE='https://www.vwmanual.ru/en/golf/5/power/engine/privod-gazoraspredelitelnogo-mehanizma-dizelnye-dvigateli-1-9'

const ENTRIES=[
  ['TORQUE','Nakrętka rolki napinającej paska rozrządu','20','Nm','+ 45° (1/8 obrotu).','rozrząd,pasek,napinacz',AVQ_SOURCE],
  ['TORQUE','Śruby koła zębatego wałka rozrządu','25','Nm','Dokręcić przy prawidłowo napiętym pasku / zgodnie z procedurą ustawienia.','rozrząd,pasek,wałek rozrządu',AVQ_SOURCE],
  ['TORQUE','Wspornik mocowania silnika do bloku cylindrów','45','Nm','Dotyczy procedury montażu paska rozrządu dla grupy silników AVQ/BRU/BJB/BKC/BLS/BDK.','rozrząd,poduszka silnika,wspornik',AVQ_SOURCE],
  ['TORQUE','Mocowanie podpory silnika do nadwozia — śruba M8','20','Nm','+ 90°. Źródło wymaga użycia nowych śrub.','rozrząd,poduszka silnika,wspornik',AVQ_SOURCE],
  ['TORQUE','Mocowanie podpory silnika do nadwozia — śruba M10','40','Nm','+ 90°. Źródło wymaga użycia nowych śrub.','rozrząd,poduszka silnika,wspornik',AVQ_SOURCE],
  ['TORQUE','Połączenie podpory silnika ze wspornikiem','60','Nm','+ 90° (1/4 obrotu).','rozrząd,poduszka silnika,wspornik',AVQ_SOURCE],
  ['TORQUE','Koło pasowe napędu osprzętu na wale korbowym','10','Nm','+ 90° (1/4 obrotu).','rozrząd,koło pasowe,osprzęt',AVQ_SOURCE],
  ['TORQUE','Nakrętka rolki prowadzącej paska rozrządu','20','Nm','Pozycja 12 na zestawieniu napędu rozrządu.','rozrząd,pasek,rolka prowadząca',AVQ_DRIVE_SOURCE],
  ['TORQUE','Śruba tylnej osłony napędu rozrządu','25','Nm','Pozycja 8 na zestawieniu napędu rozrządu.','rozrząd,osłona',AVQ_DRIVE_SOURCE],
  ['TORQUE','Śruba piasty/elementu napędu wałka — pozycja 6 zestawienia','10','Nm','Źródło wskazuje wymianę śruby po każdym demontażu. Przed użyciem w pracy potwierdzić identyfikację elementu na rysunku.','rozrząd,wałek rozrządu',AVQ_DRIVE_SOURCE],
]

function seedTechnicalReference(db){
  const cols=db.prepare("PRAGMA table_info(technical_data_entries)").all().map(x=>x.name)
  if(!cols.includes('verification_level')) db.exec("ALTER TABLE technical_data_entries ADD COLUMN verification_level TEXT NOT NULL DEFAULT 'UNVERIFIED'")
  if(!cols.includes('applicability')) db.exec("ALTER TABLE technical_data_entries ADD COLUMN applicability TEXT")
  if(!cols.includes('fastener_note')) db.exec("ALTER TABLE technical_data_entries ADD COLUMN fastener_note TEXT")
  db.prepare("UPDATE technical_data_entries SET verification_level='VERIFIED' WHERE verified=1 AND (verification_level IS NULL OR verification_level='UNVERIFIED')").run()

  const exists=db.prepare(`SELECT 1 FROM technical_data_entries WHERE scope='ENGINE' AND make='Volkswagen' AND engine_code='AVQ' AND parameter=? AND source_ref=? LIMIT 1`)
  const ins=db.prepare(`INSERT INTO technical_data_entries(scope,make,engine,engine_code,category,parameter,value,unit,notes,work_tags,source_type,source_name,source_ref,source_date,verified,verification_level,applicability,fastener_note)
    VALUES ('ENGINE','Volkswagen','1.9 TDI','AVQ',?,?,?,?,?,?,'MANUAL','VWmanual.ru — secondary technical manual reproduction',?,'2026-09-08',0,'CORROBORATED_SECONDARY','AVQ; source page groups AVQ/BRU/BJB/BKC/BLS/BDK','Verify against VIN-matched OEM repair information before safety-critical work')`)
  const tx=db.transaction(()=>{
    for(const [category,parameter,value,unit,notes,tags,url] of ENTRIES){
      if(!exists.get(parameter,url)) ins.run(category,parameter,value,unit,notes,tags,url)
    }
  })
  tx()
}
module.exports={seedTechnicalReference,TECHNICAL_REFERENCE_COUNT:ENTRIES.length}

