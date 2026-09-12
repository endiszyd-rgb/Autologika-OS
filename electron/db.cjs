const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const { seedTechnicalReference } = require('./technical-seed.cjs')
const { migrateLegacyServiceReminders } = require('./service-reminders.cjs')

let db
const SCHEMA_VERSION = 7
const databasePath = () => path.join(app.getPath('userData'), 'autologika.db')
const backupDirectory = () => path.join(app.getPath('userData'), 'backups')
const safeTimestamp = () => new Date().toISOString().replace(/[:.]/g,'-')

function checkpointDatabase(database){
  try{ database.pragma('wal_checkpoint(FULL)') }catch{}
}

function createMigrationBackup(database,dbPath,fromVersion,toVersion){
  const dir=backupDirectory();fs.mkdirSync(dir,{recursive:true})
  checkpointDatabase(database)
  const stamp=safeTimestamp(),file=path.join(dir,`autologika-before-schema-${fromVersion}-to-${toVersion}-${stamp}.db`)
  fs.copyFileSync(dbPath,file)
  const manifest={kind:'BEFORE_MIGRATION',createdAt:new Date().toISOString(),applicationVersion:app.getVersion(),schemaFrom:fromVersion,schemaTo:toVersion,databasePath:dbPath,backupPath:file}
  const manifestPath=file.replace(/\.db$/,'.json');fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2),'utf8')
  return{file,manifestPath,manifest}
}

async function createVersionBackup({currentVersion=app.getVersion(),targetVersion='',kind='BEFORE_UPDATE'}={}){
  const database=getDb(),dbPath=databasePath(),dir=backupDirectory();fs.mkdirSync(dir,{recursive:true})
  checkpointDatabase(database)
  const stamp=safeTimestamp(),file=path.join(dir,`autologika-${String(kind).toLowerCase().replace(/_/g,'-')}-${currentVersion}-to-${targetVersion||'unknown'}-${stamp}.db`)
  await database.backup(file)
  if(!fs.existsSync(file)||fs.statSync(file).size===0)throw new Error('Kopia bazy nie została utworzona poprawnie.')
  const manifest={kind,createdAt:new Date().toISOString(),currentVersion,targetVersion,databasePath:dbPath,backupPath:file,schemaVersion:database.pragma('user_version',{simple:true})}
  const manifestPath=file.replace(/\.db$/,'.json');fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2),'utf8')
  return{file,manifestPath,manifest}
}

function getDb() {
  if (db) return db
  const dbPath = databasePath(), existed=fs.existsSync(dbPath)&&fs.statSync(dbPath).size>0
  fs.mkdirSync(path.dirname(dbPath),{recursive:true})
  db = new Database(dbPath)
  const currentVersion=Number(db.pragma('user_version',{simple:true})||0)
  let safetyBackup=null
  try{
    if(currentVersion>SCHEMA_VERSION)throw new Error(`Baza danych ma nowszy schemat (${currentVersion}) niż ta wersja programu (${SCHEMA_VERSION}). Automatyczny downgrade jest zablokowany.`)
    if(existed&&currentVersion<SCHEMA_VERSION)safetyBackup=createMigrationBackup(db,dbPath,currentVersion,SCHEMA_VERSION)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db,currentVersion)
  }catch(error){
    try{db.close()}catch{};db=undefined
    error.backupPath=safetyBackup?.file||''
    throw error
  }
  seed(db)
  const templateCount=db.prepare("SELECT COUNT(*) c FROM message_templates").get().c
  if(!templateCount){
    const ins=db.prepare("INSERT INTO message_templates(name,body,kind) VALUES (?,?,?)")
    const defaults=[
      ['Diagnoza gotowa','Dzień dobry, mamy już wynik diagnostyki {auto} ({rej}). Proszę o kontakt w sprawie dalszych działań. AUTOLOGIKA','DIAGNOZA'],
      ['Wycena do akceptacji','Dzień dobry, wycena naprawy {auto} ({rej}) wynosi {kwota}. Proszę o potwierdzenie, czy realizujemy naprawę. AUTOLOGIKA','WYCENA'],
      ['Czekamy na część','Dzień dobry, do {auto} ({rej}) czekamy na zamówioną część. Damy znać od razu po jej dostawie. AUTOLOGIKA','CZESCI'],
      ['Auto gotowe','Dzień dobry, {auto} ({rej}) jest gotowe do odbioru. Kwota do zapłaty: {kwota}. AUTOLOGIKA','GOTOWE'],
      ['Przypomnienie o decyzji','Dzień dobry, wracam do wyceny dotyczącej {auto} ({rej}). Czekamy na decyzję, czy mamy kontynuować naprawę. AUTOLOGIKA','PRZYPOMNIENIE']
    ]
    const tx=db.transaction(()=>defaults.forEach(x=>ins.run(...x))); tx()
  }

  return db
}

function migrate(db,currentVersion=0) {
  if(currentVersion>=SCHEMA_VERSION)return
  if(currentVersion<1){
    db.transaction(()=>{migrateSchemaV1(db);db.pragma('user_version = 1')})()
    currentVersion=1
  }
  if(currentVersion<2){
    // SQLite nie pozwala usunąć NOT NULL przez ALTER TABLE. Odtwarzamy wyłącznie
    // tabelę pojazdów, zachowując wszystkie kolumny, indeksy, triggery i dane.
    db.pragma('foreign_keys = OFF')
    try{
      db.transaction(()=>{migrateSchemaV2(db);db.pragma('user_version = 2')})()
    }finally{
      db.pragma('foreign_keys = ON')
    }
    const foreignKeyErrors=db.pragma('foreign_key_check')
    if(foreignKeyErrors.length)throw new Error('Migracja pojazdów naruszyła spójność bazy danych.')
    currentVersion=2
  }
  if(currentVersion<3){
    db.transaction(()=>{migrateSchemaV3(db);db.pragma('user_version = 3')})()
    currentVersion=3
  }
  if(currentVersion<4){
    db.transaction(()=>{migrateSchemaV4(db);db.pragma('user_version = 4')})()
    currentVersion=4
  }
  if(currentVersion<5){
    db.transaction(()=>{migrateSchemaV5(db);db.pragma('user_version = 5')})()
    currentVersion=5
  }
  if(currentVersion<6){
    db.transaction(()=>{migrateSchemaV6(db);db.pragma('user_version = 6')})()
    currentVersion=6
  }
  if(currentVersion<7){
    db.transaction(()=>{migrateSchemaV7(db);db.pragma('user_version = 7')})()
  }
}

function migrateSchemaV7(db){
  migrateLegacyServiceReminders(db)
}

function migrateSchemaV6(db){
  const existing=db.prepare('PRAGMA table_info(inventory_parts)').all().map(x=>x.name)
  if(!existing.includes('vehicle_fitment'))db.exec('ALTER TABLE inventory_parts ADD COLUMN vehicle_fitment TEXT')
  if(!existing.includes('cross_numbers'))db.exec('ALTER TABLE inventory_parts ADD COLUMN cross_numbers TEXT')
}

function migrateSchemaV5(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS barcode_lookup_cache (
      barcode TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('FOUND','MISS')),
      source TEXT,
      lookup_url TEXT,
      payload_json TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_barcode_lookup_cache_expires ON barcode_lookup_cache(expires_at);
  `)
}

function migrateSchemaV4(db){
  const existing=db.prepare('PRAGMA table_info(order_items)').all().map(x=>x.name)
  if(!existing.includes('inventory_part_id'))db.exec('ALTER TABLE order_items ADD COLUMN inventory_part_id INTEGER')
  db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_inventory_part ON order_items(inventory_part_id)')
}

function migrateSchemaV3(db){
  const columns=[['barcode','TEXT'],['brand','TEXT'],['category','TEXT'],['description','TEXT'],['image_url','TEXT'],['lookup_source','TEXT'],['lookup_url','TEXT'],['cloud_id','TEXT'],['deleted_at','TEXT'],['version','INTEGER NOT NULL DEFAULT 1']]
  const existing=db.prepare('PRAGMA table_info(inventory_parts)').all().map(x=>x.name)
  for(const [name,type] of columns)if(!existing.includes(name))db.exec(`ALTER TABLE inventory_parts ADD COLUMN ${name} ${type}`)
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_parts_barcode ON inventory_parts(barcode) WHERE barcode IS NOT NULL AND barcode!=''")
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_parts_cloud_id ON inventory_parts(cloud_id) WHERE cloud_id IS NOT NULL')
  db.prepare('UPDATE inventory_parts SET cloud_id=lower(hex(randomblob(16))) WHERE cloud_id IS NULL').run()
  db.prepare('UPDATE inventory_parts SET updated_at=COALESCE(updated_at,CURRENT_TIMESTAMP)').run()
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS sync_inventory_parts_assign_cloud AFTER INSERT ON inventory_parts
    WHEN NEW.cloud_id IS NULL BEGIN UPDATE inventory_parts SET cloud_id=lower(hex(randomblob(16))),updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
    CREATE TRIGGER IF NOT EXISTS sync_inventory_parts_insert AFTER INSERT ON inventory_parts
    WHEN NEW.cloud_id IS NOT NULL AND COALESCE((SELECT value FROM sync_meta WHERE key='applying_remote'),'0')!='1'
    BEGIN INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation) VALUES ('inventory_parts',NEW.id,NEW.cloud_id,'UPSERT'); END;
    CREATE TRIGGER IF NOT EXISTS sync_inventory_parts_update AFTER UPDATE ON inventory_parts
    WHEN COALESCE((SELECT value FROM sync_meta WHERE key='applying_remote'),'0')!='1'
    BEGIN
      UPDATE inventory_parts SET updated_at=CURRENT_TIMESTAMP,version=COALESCE(OLD.version,1)+1 WHERE id=NEW.id AND NEW.updated_at IS OLD.updated_at;
      DELETE FROM sync_queue WHERE entity_type='inventory_parts' AND row_id=NEW.id;
      INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation) VALUES ('inventory_parts',NEW.id,COALESCE(NEW.cloud_id,OLD.cloud_id),'UPSERT');
    END;
    CREATE TRIGGER IF NOT EXISTS sync_inventory_parts_delete AFTER DELETE ON inventory_parts
    WHEN COALESCE((SELECT value FROM sync_meta WHERE key='applying_remote'),'0')!='1'
    BEGIN
      DELETE FROM sync_queue WHERE entity_type='inventory_parts' AND cloud_id=OLD.cloud_id;
      INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation) VALUES ('inventory_parts',NULL,OLD.cloud_id,'DELETE');
    END;
  `)
  db.exec(`INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation)
    SELECT 'inventory_parts',p.id,p.cloud_id,'UPSERT' FROM inventory_parts p
    WHERE NOT EXISTS (SELECT 1 FROM sync_queue q WHERE q.entity_type='inventory_parts' AND q.row_id=p.id)`)
}

function migrateSchemaV2(db){
  const table=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='vehicles'").get()
  if(!table?.sql)throw new Error('Nie znaleziono tabeli pojazdów podczas migracji.')
  const customerColumn=db.prepare("PRAGMA table_info(vehicles)").all().find(column=>column.name==='customer_id')
  if(!customerColumn?.notnull)return
  const dependentSchema=db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='vehicles' AND type IN ('index','trigger') AND sql IS NOT NULL").all().map(row=>row.sql)
  const columns=db.prepare('PRAGMA table_info(vehicles)').all().map(column=>`"${column.name.replace(/"/g,'""')}"`).join(',')
  const createSql=table.sql
    .replace(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`\[]?vehicles["`\]]?/i,'CREATE TABLE vehicles_v2')
    .replace(/customer_id\s+INTEGER\s+NOT NULL/i,'customer_id INTEGER')
  db.exec(createSql)
  db.exec(`INSERT INTO vehicles_v2 (${columns}) SELECT ${columns} FROM vehicles`)
  db.exec('DROP TABLE vehicles')
  db.exec('ALTER TABLE vehicles_v2 RENAME TO vehicles')
  for(const sql of dependentSchema)db.exec(sql)
}

function migrateSchemaV1(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, phone TEXT, email TEXT, company TEXT, notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL, plate TEXT, vin TEXT, make TEXT, model TEXT,
      year INTEGER, engine TEXT, mileage INTEGER, notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL, title TEXT NOT NULL, complaint TEXT,
      status TEXT NOT NULL DEFAULT 'PRZYJETE', priority TEXT NOT NULL DEFAULT 'NORMALNY',
      diagnosis_limit REAL DEFAULT 0, labor_hours REAL DEFAULT 0, labor_rate REAL DEFAULT 220,
      parts_cost REAL DEFAULT 0, parts_sale REAL DEFAULT 0, other_cost REAL DEFAULT 0,
      other_sale REAL DEFAULT 0, discount REAL DEFAULT 0, diagnosis_fee REAL DEFAULT 0,
      source TEXT DEFAULT 'nieznane', opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      due_at TEXT, closed_at TEXT, archived_at TEXT,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS diagnostics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL, symptom_confirmed TEXT, dtcs TEXT, measurements TEXT,
      hypothesis TEXT, conclusion TEXT, recommendation TEXT, time_hours REAL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL, title TEXT NOT NULL, due_date TEXT, due_mileage INTEGER,
      done INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'CZESC', name TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 1, unit_cost REAL NOT NULL DEFAULT 0, unit_price REAL NOT NULL DEFAULT 0,
      part_no TEXT, supplier TEXT, notes TEXT,
      catalog_work_id TEXT, catalog_variant_id TEXT, work_name TEXT, variant_name TEXT,
      customer_description TEXT, technical_description TEXT, hours_snapshot REAL, price_snapshot REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS work_procedure_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL, order_item_id INTEGER, template_key TEXT, title TEXT NOT NULL, variant TEXT,
      pre_json TEXT NOT NULL DEFAULT '[]', steps_json TEXT NOT NULL DEFAULT '[]', qc_json TEXT NOT NULL DEFAULT '[]',
      recommendations_json TEXT NOT NULL DEFAULT '[]', safety_json TEXT NOT NULL DEFAULT '[]',
      parts_json TEXT NOT NULL DEFAULT '[]', materials_json TEXT NOT NULL DEFAULT '[]',
      progress_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(order_item_id) REFERENCES order_items(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_work_procedure_runs_order ON work_procedure_runs(order_id);

    CREATE TABLE IF NOT EXISTS technical_data_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL DEFAULT 'VEHICLE', vehicle_id INTEGER, make TEXT, model TEXT, generation TEXT,
      year_from INTEGER, year_to INTEGER, engine TEXT, engine_code TEXT,
      category TEXT NOT NULL DEFAULT 'NOTE', parameter TEXT NOT NULL, value TEXT, unit TEXT, notes TEXT, work_tags TEXT,
      source_type TEXT NOT NULL DEFAULT 'WORKSHOP', source_name TEXT, source_ref TEXT, source_date TEXT,
      verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_technical_vehicle ON technical_data_entries(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_technical_engine ON technical_data_entries(make,engine_code);

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER, vehicle_id INTEGER, title TEXT NOT NULL,
      start_at TEXT NOT NULL, end_at TEXT NOT NULL, bay TEXT NOT NULL DEFAULT 'Stanowisko 1',
      status TEXT NOT NULL DEFAULT 'PLAN', notes TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle TEXT, engine TEXT, symptom TEXT NOT NULL, dtcs TEXT,
      measurements TEXT, cause TEXT, solution TEXT, tags TEXT,
      source_order_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_order_id) REFERENCES orders(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS work_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL, worker TEXT NOT NULL DEFAULT 'Właściciel', note TEXT,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, ended_at TEXT, duration_minutes INTEGER,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'ROBOCZA', notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, accepted_at TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'CZESC', name TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 1, unit_cost REAL NOT NULL DEFAULT 0, unit_price REAL NOT NULL DEFAULT 0,
      labor_hours REAL NOT NULL DEFAULT 0, labor_rate REAL NOT NULL DEFAULT 0, notes TEXT,
      catalog_work_id TEXT, catalog_variant_id TEXT, work_name TEXT, variant_name TEXT,
      customer_description TEXT, technical_description TEXT, hours_snapshot REAL, price_snapshot REAL,
      FOREIGN KEY(quote_id) REFERENCES quotes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL, name TEXT NOT NULL, file_path TEXT NOT NULL DEFAULT '', mime TEXT,
      storage_path TEXT, size_bytes INTEGER, sha256 TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL, signed_by TEXT NOT NULL DEFAULT 'Klient', points_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS order_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE, intake_notes TEXT, release_notes TEXT, qc_notes TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_orders_vehicle ON orders(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_at);
    CREATE INDEX IF NOT EXISTS idx_knowledge_symptom ON knowledge_cases(symptom);
    CREATE INDEX IF NOT EXISTS idx_work_logs_order ON work_logs(order_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_order ON quotes(order_id);
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, role TEXT DEFAULT 'Mechanik', hourly_cost REAL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, phone TEXT, email TEXT, account_no TEXT, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS inventory_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_no TEXT, name TEXT NOT NULL, stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0, sell_price REAL NOT NULL DEFAULT 0, supplier_id INTEGER, location TEXT, notes TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, status TEXT NOT NULL DEFAULT 'ROBOCZE',
      ordered_at TEXT, expected_at TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_order_id INTEGER NOT NULL, inventory_part_id INTEGER,
      part_no TEXT, name TEXT NOT NULL, qty REAL NOT NULL DEFAULT 1, unit_cost REAL NOT NULL DEFAULT 0, received_qty REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY(inventory_part_id) REFERENCES inventory_parts(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS job_part_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, supplier_id INTEGER,
      part_no TEXT, name TEXT NOT NULL, qty REAL NOT NULL DEFAULT 1, unit_cost REAL NOT NULL DEFAULT 0, unit_price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'DO_ZAMOWIENIA', external_order_no TEXT, expected_at TEXT, ordered_at TEXT, received_at TEXT, installed_at TEXT, returned_at TEXT,
      notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE, FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_job_parts_order ON job_part_orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_job_parts_status ON job_part_orders(status);
    CREATE INDEX IF NOT EXISTS idx_inventory_part_no ON inventory_parts(part_no);
    CREATE INDEX IF NOT EXISTS idx_purchase_status ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id);

    CREATE TABLE IF NOT EXISTS communications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      direction TEXT NOT NULL DEFAULT 'OUT',
      channel TEXT NOT NULL DEFAULT 'TELEFON',
      message TEXT NOT NULL,
      contact_name TEXT,
      needs_reply INTEGER NOT NULL DEFAULT 0,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_communications_order ON communications(order_id);
    CREATE INDEX IF NOT EXISTS idx_communications_reply ON communications(needs_reply,resolved);

    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      amount REAL NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'TELEFON',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      decided_at TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_approvals_order ON approvals(order_id);

    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);


    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'GOTOWKA',
      reference TEXT,
      note TEXT,
      paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

    CREATE TABLE IF NOT EXISTS closeout_checks (
      order_id INTEGER PRIMARY KEY,
      customer_approved INTEGER NOT NULL DEFAULT 0,
      diagnosis_documented INTEGER NOT NULL DEFAULT 0,
      parts_documented INTEGER NOT NULL DEFAULT 0,
      work_logged INTEGER NOT NULL DEFAULT 0,
      qc_done INTEGER NOT NULL DEFAULT 0,
      payment_checked INTEGER NOT NULL DEFAULT 0,
      release_notes_done INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      document_type TEXT NOT NULL DEFAULT 'PARAGON',
      document_no TEXT,
      issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      note TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sales_refs_order ON sales_refs(order_id);

    CREATE TABLE IF NOT EXISTS service_reminders_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      order_id INTEGER,
      title TEXT NOT NULL,
      due_date TEXT,
      due_mileage INTEGER,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_service_reminders_v2_vehicle ON service_reminders_v2(vehicle_id);

    CREATE TABLE IF NOT EXISTS message_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      body TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'OTHER',
      active INTEGER NOT NULL DEFAULT 1
    );



    CREATE TABLE IF NOT EXISTS vehicle_findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL, source_order_id INTEGER, category TEXT NOT NULL DEFAULT 'USTERKA',
      title TEXT NOT NULL, details TEXT, severity TEXT NOT NULL DEFAULT 'INFO', status TEXT NOT NULL DEFAULT 'OPEN',
      due_date TEXT, due_mileage INTEGER, resolved_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY(source_order_id) REFERENCES orders(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_findings_vehicle ON vehicle_findings(vehicle_id,status);

    CREATE TABLE IF NOT EXISTS order_qc (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, check_key TEXT NOT NULL, label TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0, note TEXT, checked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_id,check_key), FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_order_qc_order ON order_qc(order_id);

    CREATE TABLE IF NOT EXISTS work_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, group_name TEXT NOT NULL DEFAULT 'Własne', variant TEXT,
      scope TEXT, hours REAL NOT NULL DEFAULT 1, rate REAL NOT NULL DEFAULT 220,
      pre_json TEXT NOT NULL DEFAULT '[]', steps_json TEXT NOT NULL DEFAULT '[]', qc_json TEXT NOT NULL DEFAULT '[]',
      parts_json TEXT NOT NULL DEFAULT '[]', materials_json TEXT NOT NULL DEFAULT '[]', recommendations_json TEXT NOT NULL DEFAULT '[]',
      safety_json TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_work_templates_group ON work_templates(group_name,active);

    CREATE TABLE IF NOT EXISTS technical_manual_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, section TEXT NOT NULL DEFAULT 'Ogólne', subsection TEXT,
      make TEXT, model TEXT, generation TEXT, year_from INTEGER, year_to INTEGER, engine TEXT, engine_code TEXT, gearbox_code TEXT,
      work_tags TEXT, page_type TEXT NOT NULL DEFAULT 'IMAGE', file_path TEXT, mime TEXT,
      source_type TEXT NOT NULL DEFAULT 'WORKSHOP', source_name TEXT, source_ref TEXT, source_date TEXT,
      verification_level TEXT NOT NULL DEFAULT 'WORKSHOP', notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_manual_vehicle ON technical_manual_pages(make,model,engine_code,section);

    CREATE TABLE IF NOT EXISTS technical_manual_hotspots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, manual_page_id INTEGER NOT NULL,
      x REAL NOT NULL DEFAULT 0.5, y REAL NOT NULL DEFAULT 0.5, w REAL NOT NULL DEFAULT 0.03, h REAL NOT NULL DEFAULT 0.03,
      label TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'TORQUE', value TEXT, unit TEXT, angle TEXT, note TEXT,
      source_type TEXT NOT NULL DEFAULT 'WORKSHOP', source_name TEXT, source_ref TEXT,
      verification_level TEXT NOT NULL DEFAULT 'WORKSHOP', technical_data_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(manual_page_id) REFERENCES technical_manual_pages(id) ON DELETE CASCADE,
      FOREIGN KEY(technical_data_id) REFERENCES technical_data_entries(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_manual_hotspots_page ON technical_manual_hotspots(manual_page_id);

    CREATE TABLE IF NOT EXISTS technical_manual_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT, manual_page_id INTEGER NOT NULL, step_no INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL, instruction TEXT, warning TEXT, tool TEXT, technical_data_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(manual_page_id) REFERENCES technical_manual_pages(id) ON DELETE CASCADE,
      FOREIGN KEY(technical_data_id) REFERENCES technical_data_entries(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_manual_steps_page ON technical_manual_steps(manual_page_id,step_no);

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL DEFAULT '',
      cloud_id TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    INSERT OR IGNORE INTO app_settings(setting_key,value,cloud_id,updated_at,version)
      VALUES ('monthly_target','50000','monthly-target',CURRENT_TIMESTAMP,1);

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      row_id INTEGER,
      cloud_id TEXT,
      operation TEXT NOT NULL DEFAULT 'UPSERT',
      queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type,row_id);

  `)


  const manualHotspotCols=db.prepare("PRAGMA table_info(technical_manual_hotspots)").all().map(x=>x.name)
  if(!manualHotspotCols.includes('part_hint')) db.exec("ALTER TABLE technical_manual_hotspots ADD COLUMN part_hint TEXT")
  if(!manualHotspotCols.includes('tool_hint')) db.exec("ALTER TABLE technical_manual_hotspots ADD COLUMN tool_hint TEXT")
  if(!manualHotspotCols.includes('sequence_ref')) db.exec("ALTER TABLE technical_manual_hotspots ADD COLUMN sequence_ref TEXT")

  // Snapshot katalogu: pozycja historyczna nie może zmienić się po edycji katalogu.
  const ensureColumns=(table,columns)=>{
    const existing=db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name)
    for(const [name,type] of columns) if(!existing.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)
  }
  const catalogSnapshotColumns=[
    ['catalog_work_id','TEXT'],['catalog_variant_id','TEXT'],['work_name','TEXT'],['variant_name','TEXT'],
    ['customer_description','TEXT'],['technical_description','TEXT'],['hours_snapshot','REAL'],['price_snapshot','REAL']
  ]
  ensureColumns('order_items',catalogSnapshotColumns)
  ensureColumns('order_items',[['oe_number','TEXT']])
  ensureColumns('quote_items',catalogSnapshotColumns)
  ensureColumns('work_procedure_runs',[['catalog_work_id','TEXT'],['catalog_variant_id','TEXT'],['technical_description','TEXT'],['technical_data_key','TEXT']])
  ensureColumns('inventory_parts',[['barcode','TEXT'],['brand','TEXT'],['category','TEXT'],['description','TEXT'],['image_url','TEXT'],['lookup_source','TEXT'],['lookup_url','TEXT']])
  ensureColumns('job_part_orders',[['oe_number','TEXT'],['inventory_part_id','INTEGER'],['vehicle_snapshot','TEXT']])
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_parts_barcode ON inventory_parts(barcode) WHERE barcode IS NOT NULL AND barcode!=''")

  const syncTables=['app_settings','customers','vehicles','orders','diagnostics','order_notes','job_part_orders','payments','appointments','suppliers','inventory_parts','order_items','work_logs','communications','approvals','order_events','sales_refs','service_reminders_v2','attachments','signatures','work_procedure_runs','technical_data_entries','vehicle_findings','order_qc','work_templates','technical_manual_pages','technical_manual_hotspots','technical_manual_steps']
  for(const table of syncTables){
    const names=db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name)
    if(!names.includes('cloud_id')) db.exec(`ALTER TABLE ${table} ADD COLUMN cloud_id TEXT`)
    if(!names.includes('updated_at')) db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT`)
    if(!names.includes('deleted_at')) db.exec(`ALTER TABLE ${table} ADD COLUMN deleted_at TEXT`)
    if(!names.includes('version')) db.exec(`ALTER TABLE ${table} ADD COLUMN version INTEGER NOT NULL DEFAULT 1`)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_cloud_id ON ${table}(cloud_id) WHERE cloud_id IS NOT NULL`)
    db.prepare(`UPDATE ${table} SET cloud_id=lower(hex(randomblob(16))) WHERE cloud_id IS NULL`).run()
    if(names.includes('created_at')) db.prepare(`UPDATE ${table} SET updated_at=COALESCE(updated_at,created_at,CURRENT_TIMESTAMP)`).run()
    else db.prepare(`UPDATE ${table} SET updated_at=COALESCE(updated_at,CURRENT_TIMESTAMP)`).run()
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS sync_${table}_assign_cloud AFTER INSERT ON ${table}
      WHEN NEW.cloud_id IS NULL
      BEGIN
        UPDATE ${table} SET cloud_id=lower(hex(randomblob(16))),updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS sync_${table}_insert AFTER INSERT ON ${table}
      WHEN NEW.cloud_id IS NOT NULL AND COALESCE((SELECT value FROM sync_meta WHERE key='applying_remote'),'0')!='1'
      BEGIN
        INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation) VALUES ('${table}',NEW.id,NEW.cloud_id,'UPSERT');
      END;
      CREATE TRIGGER IF NOT EXISTS sync_${table}_update AFTER UPDATE ON ${table}
      WHEN COALESCE((SELECT value FROM sync_meta WHERE key='applying_remote'),'0')!='1'
      BEGIN
        UPDATE ${table} SET updated_at=CURRENT_TIMESTAMP,version=COALESCE(OLD.version,1)+1 WHERE id=NEW.id AND NEW.updated_at IS OLD.updated_at;
        DELETE FROM sync_queue WHERE entity_type='${table}' AND row_id=NEW.id;
        INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation) VALUES ('${table}',NEW.id,COALESCE(NEW.cloud_id,OLD.cloud_id),'UPSERT');
      END;
      CREATE TRIGGER IF NOT EXISTS sync_${table}_delete AFTER DELETE ON ${table}
      WHEN COALESCE((SELECT value FROM sync_meta WHERE key='applying_remote'),'0')!='1'
      BEGIN
        DELETE FROM sync_queue WHERE entity_type='${table}' AND cloud_id=OLD.cloud_id;
        INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation) VALUES ('${table}',NULL,OLD.cloud_id,'DELETE');
      END;
    `)
  }

  const attachmentCols=db.prepare("PRAGMA table_info(attachments)").all().map(x=>x.name)
  if(!attachmentCols.includes('storage_path')) db.exec('ALTER TABLE attachments ADD COLUMN storage_path TEXT')
  if(!attachmentCols.includes('size_bytes')) db.exec('ALTER TABLE attachments ADD COLUMN size_bytes INTEGER')
  if(!attachmentCols.includes('sha256')) db.exec('ALTER TABLE attachments ADD COLUMN sha256 TEXT')
  if(!attachmentCols.includes('category')) db.exec("ALTER TABLE attachments ADD COLUMN category TEXT NOT NULL DEFAULT 'PRZYJECIE'")
  // Załączniki i podpisy weszły do synchronizacji w 0.19. Istniejące rekordy też muszą trafić do kolejki.
  db.prepare(`INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation)
    SELECT 'attachments',a.id,a.cloud_id,'UPSERT' FROM attachments a
    WHERE a.cloud_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sync_queue q WHERE q.entity_type='attachments' AND q.row_id=a.id)`).run()
  db.prepare(`INSERT INTO sync_queue(entity_type,row_id,cloud_id,operation)
    SELECT 'signatures',a.id,a.cloud_id,'UPSERT' FROM signatures a
    WHERE a.cloud_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sync_queue q WHERE q.entity_type='signatures' AND q.row_id=a.id)`).run()

  const procedureCols=db.prepare("PRAGMA table_info(work_procedure_runs)").all().map(x=>x.name)
  if(!procedureCols.includes('technical_json')) db.exec("ALTER TABLE work_procedure_runs ADD COLUMN technical_json TEXT NOT NULL DEFAULT '[]'")
  const vehicleCols=db.prepare("PRAGMA table_info(vehicles)").all().map(x=>x.name)
  if(!vehicleCols.includes('generation')) db.exec('ALTER TABLE vehicles ADD COLUMN generation TEXT')
  if(!vehicleCols.includes('power_hp')) db.exec('ALTER TABLE vehicles ADD COLUMN power_hp INTEGER')
  if(!vehicleCols.includes('engine_code')) db.exec('ALTER TABLE vehicles ADD COLUMN engine_code TEXT')
  const cols=db.prepare("PRAGMA table_info(work_logs)").all().map(x=>x.name)
  if(!cols.includes('employee_id')) db.exec('ALTER TABLE work_logs ADD COLUMN employee_id INTEGER')
  const orderCols=db.prepare("PRAGMA table_info(orders)").all().map(x=>x.name)
  if(!orderCols.includes('wait_state')) db.exec("ALTER TABLE orders ADD COLUMN wait_state TEXT NOT NULL DEFAULT 'BRAK'")
  if(!orderCols.includes('archived_at')) db.exec('ALTER TABLE orders ADD COLUMN archived_at TEXT')
  const commCols=db.prepare("PRAGMA table_info(communications)").all().map(x=>x.name)
  if(!commCols.includes('reply_due_at')) db.exec("ALTER TABLE communications ADD COLUMN reply_due_at TEXT")

}

function seed(db) {
  seedTechnicalReference(db)
  const manualCount=db.prepare('SELECT COUNT(*) c FROM technical_manual_pages').get().c
  if(!manualCount){
    const m=db.prepare(`INSERT INTO technical_manual_pages(title,section,subsection,page_type,source_type,source_name,verification_level,notes) VALUES (?,?,?,?,?,?,?,?)`).run('Szablon interaktywnego rysunku','Silnik','Szablon','DIAGRAM','WORKSHOP','Autologika','WORKSHOP','Poglądowy własny diagram do testowania hotspotów i procedur. Nie zawiera danych OEM.')
    db.prepare(`INSERT INTO technical_manual_hotspots(manual_page_id,x,y,label,kind,note,verification_level) VALUES (?,?,?,?,?,?,?)`).run(m.lastInsertRowid,.31,.35,'Wałek / koło — punkt demonstracyjny','NOTE','Dodaj zweryfikowaną wartość dopiero po przypisaniu właściwego pojazdu i źródła.','WORKSHOP')
    db.prepare(`INSERT INTO technical_manual_steps(manual_page_id,step_no,title,instruction) VALUES (?,?,?,?)`).run(m.lastInsertRowid,1,'Przypisz pojazd i źródło','Uzupełnij markę, model, kod silnika oraz źródło przed dodawaniem danych technicznych.')
  }
  const empCount=db.prepare('SELECT COUNT(*) c FROM employees').get().c
  if(!empCount) db.prepare('INSERT INTO employees(name,role,hourly_cost) VALUES (?,?,?)').run('Właściciel','Diagnosta / właściciel',0)
  const count = db.prepare('SELECT COUNT(*) c FROM customers').get().c
  if (count) return
  const c = db.prepare('INSERT INTO customers(name,phone,email,company,notes) VALUES (?,?,?,?,?)')
    .run('Klient demo','500 600 700','demo@autologika.pl','','Dane demonstracyjne')
  const v = db.prepare('INSERT INTO vehicles(customer_id,plate,vin,make,model,year,engine,mileage) VALUES (?,?,?,?,?,?,?,?)')
    .run(c.lastInsertRowid,'ZPL 12345','WVWZZZ1KZBW000001','Volkswagen','Touran',2011,'2.0 TDI',224500)
  const o = db.prepare(`INSERT INTO orders(vehicle_id,title,complaint,status,priority,diagnosis_limit,labor_hours,labor_rate,diagnosis_fee,source,due_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(v.lastInsertRowid,'Diagnostyka braku mocy','Auto traci moc po rozgrzaniu','DIAGNOZA','NORMALNY',350,1.2,250,300,'polecenie',new Date(Date.now()+86400000).toISOString())
  db.prepare('INSERT INTO reminders(vehicle_id,title,due_date,due_mileage) VALUES (?,?,?,?)')
    .run(v.lastInsertRowid,'Serwis olejowy',new Date(Date.now()+45*86400000).toISOString().slice(0,10),234500)
  db.prepare('INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,part_no,supplier) VALUES (?,?,?,?,?,?,?,?)')
    .run(o.lastInsertRowid,'CZESC','Filtr paliwa',1,75,105,'DEMO-001','Hurtownia demo')
  const start = new Date(Date.now()+2*3600000); const end = new Date(start.getTime()+90*60000)
  db.prepare('INSERT INTO appointments(order_id,vehicle_id,title,start_at,end_at,bay,status) VALUES (?,?,?,?,?,?,?)')
    .run(o.lastInsertRowid,v.lastInsertRowid,'Diagnostyka braku mocy',start.toISOString(),end.toISOString(),'Stanowisko 1','PLAN')
}

module.exports = { getDb, createVersionBackup, databasePath, backupDirectory, SCHEMA_VERSION }
