const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {STATUSES,archiveOrder,reopenOrder,releaseOrder,requireOrderReadyForRelease,updateOrderDetails,updateOrderStatus,updateOrderWait}=require('../electron/order-lifecycle.cjs')

test('desktop obsługuje pełny przebieg zgodny z aplikacją Android',()=>{
 assert.deepEqual(STATUSES,['PRZYJETE','DIAGNOZA','WYCENA','AKCEPTACJA','NAPRAWA','QC_NAPRAWY','QC_WYDANIA','PLATNOSC','GOTOWE','WYDANE'])
})

function database(){
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,title TEXT,complaint TEXT,priority TEXT,diagnosis_limit REAL,due_at TEXT,status TEXT,wait_state TEXT,closed_at TEXT,archived_at TEXT,version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE order_events(id INTEGER PRIMARY KEY,order_id INTEGER,event_type TEXT,title TEXT,details TEXT);
 CREATE TABLE work_logs(id INTEGER PRIMARY KEY,order_id INTEGER,started_at TEXT,ended_at TEXT,duration_minutes INTEGER);
 INSERT INTO orders VALUES(1,'Diagnostyka','Hałas','NORMALNY',300,NULL,'NAPRAWA','CZESCI',NULL,NULL,1),(2,'Serwis','Przegląd','NORMALNY',0,NULL,'WYDANE','BRAK','2026-09-20 10:00:00',NULL,1),(3,'Opony','','PILNY',0,NULL,'GOTOWE','BRAK',NULL,NULL,1);`)
 db.transaction=fn=>()=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}
 return db
}

test('zwykła zmiana statusu zapisuje historię i nie omija procesu wydania',()=>{
 const db=database()
 assert.equal(updateOrderStatus(db,1,'GOTOWE'),true)
 assert.equal(db.prepare('SELECT status FROM orders WHERE id=1').get().status,'GOTOWE')
 assert.equal(db.prepare("SELECT COUNT(*) count FROM order_events WHERE event_type='STATUS'").get().count,1)
 assert.throws(()=>updateOrderStatus(db,1,'WYDANE'),/QC/)
})

test('zamkniętego zlecenia nie można zmienić zwykłą zmianą statusu',()=>{
 const db=database()
 assert.throws(()=>updateOrderStatus(db,2,'NAPRAWA'),/kontrolowanym przywróceniu/)
 assert.throws(()=>updateOrderWait(db,2,'KLIENT'),/zamkniętym zleceniu/)
 assert.equal(db.prepare('SELECT status FROM orders WHERE id=2').get().status,'WYDANE')
})

test('edycja danych zlecenia zmienia nazwę i zapisuje historię',()=>{
 const db=database()
 const result=updateOrderDetails(db,1,{title:'Wymiana rozrządu',complaint:'Metaliczny hałas po rozruchu',priority:'PILNY',diagnosis_limit:450,due_at:'2026-10-20T14:30'})
 assert.equal(result.title,'Wymiana rozrządu')
 assert.deepEqual({...db.prepare('SELECT title,complaint,priority,diagnosis_limit,due_at FROM orders WHERE id=1').get()},{title:'Wymiana rozrządu',complaint:'Metaliczny hałas po rozruchu',priority:'PILNY',diagnosis_limit:450,due_at:'2026-10-20T14:30'})
 assert.match(db.prepare("SELECT details FROM order_events WHERE event_type='ORDER_DETAILS_UPDATED'").get().details,/Diagnostyka → Wymiana rozrządu/)
})

test('edycja zlecenia odrzuca pustą nazwę i zamknięte zlecenie',()=>{
 const db=database()
 assert.throws(()=>updateOrderDetails(db,1,{title:'   '}),/Nazwa zlecenia jest wymagana/)
 assert.throws(()=>updateOrderDetails(db,2,{title:'Korekta'}),/Zamknięte zlecenie/)
})

test('edycja zlecenia odrzuca nieaktualną wersję z innego urządzenia',()=>{
 const db=database()
 db.exec('UPDATE orders SET version=4 WHERE id=1')
 assert.throws(()=>updateOrderDetails(db,1,{title:'Nieaktualna korekta',expected_version:3}),/zmienione na innym urządzeniu/)
 assert.equal(db.prepare('SELECT title FROM orders WHERE id=1').get().title,'Diagnostyka')
 assert.equal(db.prepare('SELECT COUNT(*) count FROM order_events').get().count,0)
})

test('zapis identycznych danych nie zaśmieca historii zlecenia',()=>{
 const db=database()
 const result=updateOrderDetails(db,1,{title:'Diagnostyka',complaint:'Hałas',priority:'NORMALNY',diagnosis_limit:300,due_at:null,expected_version:1})
 assert.equal(result.changed,false)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM order_events').get().count,0)
})

test('ponowne otwarcie wymaga powodu, przywraca GOTOWE i zapisuje audyt',()=>{
 const db=database()
 assert.throws(()=>reopenOrder(db,2,''),/powód/)
 const result=reopenOrder(db,2,'Korekta ilości części po inwentaryzacji')
 assert.deepEqual({...result},{ok:true,id:2,status:'GOTOWE'})
 const order=db.prepare('SELECT * FROM orders WHERE id=2').get()
 assert.equal(order.status,'GOTOWE')
 assert.equal(order.closed_at,null)
 assert.equal(order.archived_at,null)
 assert.match(db.prepare("SELECT details FROM order_events WHERE event_type='ORDER_REOPENED'").get().details,/Korekta ilości/)
})

test('archiwizacja jest dozwolona dopiero dla gotowego zlecenia i również trafia do historii',()=>{
 const db=database()
 assert.equal(archiveOrder(db,1).ok,false)
 assert.equal(archiveOrder(db,3).ok,true)
 assert.ok(db.prepare('SELECT archived_at FROM orders WHERE id=3').get().archived_at)
 assert.equal(db.prepare("SELECT COUNT(*) count FROM order_events WHERE event_type='ORDER_ARCHIVED'").get().count,1)
})


test('wydanie wymaga aktywnego zlecenia, ale nie wymaga statusu GOTOWE',()=>{
 const db=database()
 assert.equal(requireOrderReadyForRelease(db,1).status,'NAPRAWA')
 assert.equal(requireOrderReadyForRelease(db,3).status,'GOTOWE')
 db.prepare("UPDATE orders SET archived_at='2026-09-22' WHERE id=3").run()
 assert.throws(()=>requireOrderReadyForRelease(db,3),/do korekty/i)
})

test('zamknięcie nie wymaga uzupełnienia opcjonalnej checklisty',()=>{
 const db=database()
 const result=releaseOrder(db,1,{completed:0,total:7})
 assert.deepEqual({...result},{ok:true,id:1,status:'WYDANE'})
 const order=db.prepare('SELECT status,wait_state,closed_at FROM orders WHERE id=1').get()
 assert.equal(order.status,'WYDANE')
 assert.equal(order.wait_state,'BRAK')
 assert.ok(order.closed_at)
 assert.match(db.prepare("SELECT details FROM order_events WHERE event_type='ORDER_RELEASED'").get().details,/0\/7/)
 assert.throws(()=>releaseOrder(db,1,{completed:7,total:7}),/już zamknięte/i)
})

test('wydanie automatycznie kończy aktywne liczniki czasu tego zlecenia',()=>{
 const db=database()
 db.exec("INSERT INTO work_logs(id,order_id,started_at) VALUES(7,1,'2026-10-15 10:00:00'),(8,3,'2026-10-15 10:00:00')")
 releaseOrder(db,1,{now:Date.parse('2026-10-15T10:35:00Z')})
 const stopped=db.prepare('SELECT ended_at,duration_minutes FROM work_logs WHERE id=7').get()
 assert.equal(stopped.duration_minutes,35)
 assert.equal(stopped.ended_at,'2026-10-15 10:35:00')
 assert.equal(db.prepare('SELECT ended_at FROM work_logs WHERE id=8').get().ended_at,null)
 assert.match(db.prepare("SELECT details FROM order_events WHERE event_type='ORDER_RELEASED'").get().details,/1 \(35 min\)/)
})
