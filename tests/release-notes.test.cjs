const test=require('node:test')
const assert=require('node:assert/strict')
const {notesText}=require('../electron/release-notes.cjs')

test('release notes convert GitHub HTML into readable plain text',()=>{
 const html='<p>Nowa wersja łączy moduły.</p><ul><li>Skanowanie kodów.</li><li>Ustawienia -&gt; Aktualizacje.</li></ul><p>Gotowe &amp; sprawdzone.</p>'
 assert.equal(notesText(html),'Nowa wersja łączy moduły.\n• Skanowanie kodów.\n• Ustawienia -> Aktualizacje.\n\nGotowe & sprawdzone.')
})

test('release notes support arrays returned by electron-updater',()=>{
 assert.equal(notesText([{version:'1.0.7',note:'<b>Poprawki</b><br>Gotowe'}]),'Poprawki\nGotowe')
})
