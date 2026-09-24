const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {archiveOrder,reopenOrder,releaseOrder,requireOrderReadyForRelease,updateOrderStatus,updateOrderWait}=require('../electron/order-lifecycle.cjs')

function database(){
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT,wait_state TEXT,closed_at TEXT,archived_at TEXT);
 CREATE TABLE order_events(id INTEGER PRIMARY KEY,order_id INTEGER,event_type TEXT,title TEXT,details TEXT);
 INSERT INTO orders VALUES(1,'NAPRAWA','CZESCI',NULL,NULL),(2,'WYDANE','BRAK','2026-09-20 10:00:00',NULL),(3,'GOTOWE','BRAK',NULL,NULL);`)
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
