const test=require('node:test'),assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {withQuoteHistory}=require('../electron/quote-history.cjs')
function fixture(){
 const db=new DatabaseSync(':memory:')
 db.exec('CREATE TABLE quotes(id INTEGER PRIMARY KEY,order_id INTEGER);CREATE TABLE quote_items(id INTEGER PRIMARY KEY,quote_id INTEGER,name TEXT,unit_price REAL);CREATE TABLE order_events(order_id INTEGER,event_type TEXT,title TEXT,details TEXT);INSERT INTO quotes VALUES(1,7);INSERT INTO quote_items VALUES(1,1,\'Part\',100);')
 db.transaction=fn=>(...args)=>{db.exec('BEGIN');try{const r=fn(...args);db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}
 return db
}
test('quote edit and deletion preserve exact before and after snapshots',()=>{
 const db=fixture()
 withQuoteHistory(db,{itemId:1,action:'Edit'},()=>db.prepare('UPDATE quote_items SET unit_price=? WHERE id=1').run(125.5))
 withQuoteHistory(db,{itemId:1,action:'Remove'},()=>db.exec('DELETE FROM quote_items WHERE id=1'))
 const events=db.prepare('SELECT * FROM order_events').all()
 assert.equal(events.length,2);assert.equal(events[0].order_id,7)
 assert.equal(JSON.parse(events[0].details).before[0].unit_price,100)
 assert.equal(JSON.parse(events[0].details).after[0].unit_price,125.5)
 assert.deepEqual(JSON.parse(events[1].details).after,[]);db.close()
})
test('failed financial mutation rolls back and produces no history',()=>{
 const db=fixture()
 assert.throws(()=>withQuoteHistory(db,{orderId:7,action:'Fail'},()=>{db.exec('DELETE FROM quote_items');throw new Error('fail')}))
 assert.equal(db.prepare('SELECT COUNT(*) n FROM quote_items').get().n,1)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM order_events').get().n,0);db.close()
})
