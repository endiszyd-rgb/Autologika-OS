const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {createOrderItem,issueInventoryPart,removeOrderItem,updateOrderItem,updateOrderItemDescription}=require('../electron/inventory-usage.cjs')

function database(){
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE suppliers(id INTEGER PRIMARY KEY,name TEXT);
  CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY,supplier_id INTEGER,name TEXT,part_no TEXT,location TEXT,stock REAL,unit_cost REAL,sell_price REAL,updated_at TEXT);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT,archived_at TEXT,parts_cost REAL DEFAULT 0,parts_sale REAL DEFAULT 0,other_cost REAL DEFAULT 0,other_sale REAL DEFAULT 0);
  CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,kind TEXT,name TEXT,qty REAL,unit_cost REAL,unit_price REAL,part_no TEXT,oe_number TEXT,supplier TEXT,notes TEXT,catalog_work_id TEXT,catalog_variant_id TEXT,work_name TEXT,variant_name TEXT,customer_description TEXT,technical_description TEXT,hours_snapshot REAL,price_snapshot REAL,inventory_part_id INTEGER);
  CREATE TABLE job_part_orders(id INTEGER PRIMARY KEY,order_id INTEGER,name TEXT,qty REAL,unit_cost REAL,unit_price REAL,part_no TEXT,oe_number TEXT,supplier_name TEXT,status TEXT,installed_at TEXT,updated_at TEXT,cloud_id TEXT);
  CREATE TABLE order_events(id INTEGER PRIMARY KEY,order_id INTEGER,event_type TEXT,title TEXT,details TEXT);
  INSERT INTO suppliers VALUES(1,'Moto Dostawca');
  INSERT INTO inventory_parts VALUES(7,1,'Filtr oleju','W 712/95','A-03',4,24.5,49,NULL);
  INSERT INTO orders(id,status) VALUES(3,'NAPRAWA');
 `)
 db.transaction=fn=>()=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}
 return db
}

test('wydanie części zmniejsza stan i dodaje wycenioną pozycję do zlecenia',()=>{
 const db=database()
 const result=issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:2,oeNumber:'11428507683'})
 assert.equal(result.remaining,2)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,2)
 const item=db.prepare('SELECT * FROM order_items WHERE id=?').get(result.id)
 assert.equal(item.inventory_part_id,7)
 assert.equal(item.name,'Filtr oleju')
 assert.equal(item.qty,2)
 assert.equal(item.unit_cost,24.5)
 assert.equal(item.unit_price,49)
 assert.equal(item.oe_number,'11428507683')
 const order=db.prepare('SELECT parts_cost,parts_sale FROM orders WHERE id=3').get()
 assert.equal(order.parts_cost,49)
 assert.equal(order.parts_sale,98)
})

test('ręczne dodanie pozycji waliduje dane, przelicza zlecenie i zapisuje historię',()=>{
 const db=database()
 const result=createOrderItem(db,3,{kind:'USLUGA_ZEW',name:'Geometria kół',qty:1,unit_cost:100,unit_price:180,customer_description:'Ustawienie geometrii'})
 assert.ok(result.id>0)
 assert.equal(db.prepare('SELECT other_cost FROM orders WHERE id=3').get().other_cost,100)
 assert.equal(db.prepare('SELECT other_sale FROM orders WHERE id=3').get().other_sale,180)
 assert.equal(db.prepare("SELECT COUNT(*) count FROM order_events WHERE event_type='ORDER_ITEM_ADDED'").get().count,1)
 assert.throws(()=>createOrderItem(db,3,{kind:'CZESC',name:'Błędna część',qty:-1,unit_cost:1,unit_price:1}),/większe od zera/)
})

test('zamknięte zlecenie chroni dodawanie, opisy i usuwanie pozycji oraz stan magazynu',()=>{
 const db=database(),issued=issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:1})
 db.exec("UPDATE orders SET status='WYDANE' WHERE id=3")
 assert.throws(()=>createOrderItem(db,3,{kind:'MATERIAL',name:'Czyściwo',qty:1,unit_cost:1,unit_price:2}),/zamknięte/)
 assert.throws(()=>updateOrderItemDescription(db,issued.id,'zmieniony opis'),/zamknięte/)
 assert.throws(()=>removeOrderItem(db,issued.id),/zamknięte/)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,3)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM order_items WHERE id=?').get(issued.id).count,1)
})

test('brak stanu cofa całą operację',()=>{
 const db=database()
 assert.throws(()=>issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:5}),/Za mało części/)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,4)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM order_items').get().count,0)
})

test('usunięcie pozycji magazynowej zwraca ilość na stan i przelicza zlecenie',()=>{
 const db=database()
 const issued=issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:1.5})
 const result=removeOrderItem(db,issued.id)
 assert.equal(result.removed,true)
 assert.equal(result.restored,1.5)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,4)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM order_items').get().count,0)
 const order=db.prepare('SELECT parts_cost,parts_sale FROM orders WHERE id=3').get()
 assert.equal(order.parts_cost,0)
 assert.equal(order.parts_sale,0)
})

test('edycja pozycji magazynowej koryguje stan, ceny i sumy zlecenia',()=>{
 const db=database(),issued=issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:1})
 const result=updateOrderItem(db,issued.id,{name:'Filtr oleju premium',qty:2,unit_cost:25,unit_price:55,part_no:'W 712/95',oe_number:'OE-1',supplier:'Moto Dostawca',customer_description:'Wymiana filtra'})
 assert.equal(result.stockDelta,-1)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,2)
 const item=db.prepare('SELECT * FROM order_items WHERE id=?').get(issued.id)
 assert.equal(item.name,'Filtr oleju premium')
 assert.equal(item.qty,2)
 assert.equal(item.unit_price,55)
 assert.equal(item.customer_description,'Wymiana filtra')
 const order=db.prepare('SELECT parts_cost,parts_sale FROM orders WHERE id=3').get()
 assert.equal(order.parts_cost,50)
 assert.equal(order.parts_sale,110)
 assert.equal(db.prepare("SELECT COUNT(*) count FROM order_events WHERE event_type='ORDER_ITEM_UPDATED'").get().count,1)
})

test('edycja nie pozwala wydać większej ilości niż stan ani zmienić zamkniętego zlecenia',()=>{
 const db=database(),issued=issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:1})
 assert.throws(()=>updateOrderItem(db,issued.id,{name:'Filtr',qty:6,unit_cost:20,unit_price:40}),/Za mało części/)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,3)
 db.exec("UPDATE orders SET status='WYDANE' WHERE id=3")
  assert.throws(()=>updateOrderItem(db,issued.id,{name:'Filtr',qty:1,unit_cost:20,unit_price:40}),/zamknięte/)
})

test('edycja naliczonej części aktualizuje powiązane zamówienie',()=>{
 const db=database()
 db.exec(`INSERT INTO job_part_orders VALUES(12,3,'Czujnik',1,80,120,'CAT-1','OE-1','Dostawca','ZAMONTOWANE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'job-part-cloud-12')`)
 const item=createOrderItem(db,3,{kind:'CZESC',name:'Czujnik',qty:1,unit_cost:80,unit_price:120})
 db.prepare('UPDATE order_items SET technical_description=? WHERE id=?').run('AUTOLOGIKA_JOB_PART:job-part-cloud-12',item.id)
 const result=updateOrderItem(db,item.id,{name:'Czujnik ciśnienia',qty:2,unit_cost:75,unit_price:145,part_no:'CAT-2',oe_number:'OE-2',supplier:'Nowy dostawca'})
 assert.equal(result.linkedJobPartCloudId,'job-part-cloud-12')
 assert.deepEqual({...db.prepare('SELECT name,qty,unit_cost,unit_price,part_no,oe_number,supplier_name,status FROM job_part_orders WHERE id=12').get()},{name:'Czujnik ciśnienia',qty:2,unit_cost:75,unit_price:145,part_no:'CAT-2',oe_number:'OE-2',supplier_name:'Nowy dostawca',status:'ZAMONTOWANE'})
})

test('usunięcie naliczonej części cofa powiązane zamówienie do odebranych',()=>{
 const db=database()
 db.exec(`INSERT INTO job_part_orders VALUES(12,3,'Czujnik',1,80,120,'CAT-1','OE-1','Dostawca','ZAMONTOWANE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'job-part-cloud-12')`)
 const item=createOrderItem(db,3,{kind:'CZESC',name:'Czujnik',qty:1,unit_cost:80,unit_price:120})
 db.prepare('UPDATE order_items SET technical_description=? WHERE id=?').run('AUTOLOGIKA_JOB_PART:job-part-cloud-12',item.id)
 const result=removeOrderItem(db,item.id)
 assert.equal(result.linkedJobPartCloudId,'job-part-cloud-12')
 const linked=db.prepare('SELECT status,installed_at FROM job_part_orders WHERE id=12').get()
 assert.equal(linked.status,'ODEBRANE')
 assert.equal(linked.installed_at,null)
})
