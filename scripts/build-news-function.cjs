// Generuje supabase/functions/news/news-feed.generated.mjs z shared/news-feed.cjs,
// żeby funkcja serwera (Deno) i aplikacja parsowały wiadomości tym samym kodem.
// Uruchom po każdej zmianie shared/news-feed.cjs: node scripts/build-news-function.cjs
// (test tests/news-function.test.cjs pilnuje, że plik jest aktualny).
const fs=require('node:fs'),path=require('node:path')
const root=path.join(__dirname,'..')
// Końce linii ujednolicone (LF) — wynik nie zależy od ustawień git (autocrlf)
const source=fs.readFileSync(path.join(root,'shared','news-feed.cjs'),'utf8').replace(/\r\n/g,'\n')
const target=path.join(root,'supabase','functions','news','news-feed.generated.mjs')

function render(){
 if(/\brequire\(/.test(source))throw new Error('shared/news-feed.cjs nie może używać require() — funkcja serwera dostaje jeden plik.')
 const names=source.match(/module\.exports=\{([^}]*)\}/)[1].split(',').map(name=>name.trim()).filter(Boolean)
 return [
  '// Wygenerowane przez scripts/build-news-function.cjs z shared/news-feed.cjs. Nie edytuj ręcznie.',
  // Kod modułu w osobnym zasięgu, żeby jego stałe nie kolidowały z eksportami poniżej
  'const shared=(()=>{',
  'const module={exports:{}}',
  source.trim(),
  'return module.exports',
  '})()',
  `export const {${names.join(',')}}=shared`,
  ''
 ].join('\n')
}

if(require.main===module){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,render());console.log('Zapisano',path.relative(root,target))}
module.exports={render,target}
