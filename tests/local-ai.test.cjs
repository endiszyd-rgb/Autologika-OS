const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const localAI = require('../electron/local-ai.cjs')

async function fakeOllama(handler) {
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { endpoint: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) }
}

test('lokalne AI odrzuca adres spoza komputera', () => {
  assert.throws(() => localAI.normalizeConfig({ endpoint: 'https://example.com' }), /wyłącznie z tym komputerem/)
})

test('status rozpoznaje działający serwer i wymagany model', async t => {
  const api = await fakeOllama((request, response) => {
    assert.equal(request.url, '/api/tags')
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ models: [{ name: 'qwen3:4b-instruct', size: 2500000000, details: { parameter_size: '4B' } }] }))
  })
  t.after(api.close)
  const result = await localAI.status({ enabled: true, endpoint: api.endpoint, model: 'qwen3:4b-instruct' })
  assert.equal(result.running, true)
  assert.equal(result.installed, true)
  assert.equal(result.ready, true)
  assert.equal(result.models[0].details.parameter_size, '4B')
})

test('pobieranie modelu raportuje postęp strumienia Ollamy', async t => {
  let tags = 0
  const api = await fakeOllama((request, response) => {
    if (request.url === '/api/pull') {
      response.write('{"status":"pulling manifest"}\n')
      response.write('{"status":"downloading","completed":50,"total":100}\n')
      return response.end('{"status":"success","completed":100,"total":100}\n')
    }
    tags++
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ models: [{ name: 'qwen3:4b-instruct' }] }))
  })
  t.after(api.close)
  const progress = []
  const result = await localAI.pullModel({ enabled: true, endpoint: api.endpoint, model: 'qwen3:4b-instruct' }, item => progress.push(item))
  assert.equal(result.installed, true)
  assert.ok(progress.some(item => item.percent === 50))
  assert.equal(progress.at(-1).percent, 100)
  assert.equal(tags, 1)
})

test('analiza naprawy wysyła kontekst i odczytuje odpowiedź JSON', async t => {
  let body
  const answer = { summary: 'Sprawdź obwód czujnika', confidence: 'ŚREDNIA', hypotheses: [{ title: 'Wiązka', reason: 'DTC wskazuje obwód', confidence: 'średnia', checks: ['ciągłość'] }], next_tests: ['Pomiar zasilania'], questions: [], cautions: ['Nie wymieniaj części bez pomiaru'] }
  const api = await fakeOllama((request, response) => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ model: 'qwen3:4b-instruct', message: { role: 'assistant', content: JSON.stringify(answer) }, prompt_eval_count: 30, eval_count: 20 })) })
  })
  t.after(api.close)
  const result = await localAI.analyzeRepair({ enabled: true, endpoint: api.endpoint, model: 'qwen3:4b-instruct' }, { order: { make: 'VW', model: 'Golf' }, diagnostic: { dtcs: 'P2453' } })
  assert.equal(result.summary, answer.summary)
  assert.equal(result.model, 'qwen3:4b-instruct')
  assert.equal(body.stream, false)
  assert.equal(body.think, false)
  assert.equal(body.format.type, 'object')
})

test('raport UX jest dopisywany do osobnego pliku tekstowego', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autologika-ai-'))
  const file = localAI.appendFeedback(root, { page: 'center', model: 'test-model', content: 'P1: zwiększ przycisk.' })
  const contents = fs.readFileSync(file, 'utf8')
  assert.match(file, /AI Feedback.*\.txt$/)
  assert.match(contents, /Widok: center/)
  assert.match(contents, /P1: zwiększ przycisk/)
})

test('koordynator procesu naprawy zwraca następne działania i ryzyka', async t => {
  const answer = { summary: 'Zakres wymaga zatwierdzenia', current_stage: 'WYCENA', next_actions: ['Sprawdź ceny części'], risks: ['Brak akceptacji'], missing_data: ['Decyzja klienta'], cost_controls: ['Porównaj koszt i sprzedaż'] }
  const api = await fakeOllama((request, response) => {
    request.resume()
    request.on('end', () => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ model: 'qwen3:4b-instruct', message: { role: 'assistant', content: JSON.stringify(answer) } })) })
  })
  t.after(api.close)
  const result = await localAI.analyzeWorkflow({ enabled: true, endpoint: api.endpoint, model: 'qwen3:4b-instruct' }, { order: { status: 'WYCENA' }, repairs: [] })
  assert.deepEqual(result.next_actions, answer.next_actions)
  assert.deepEqual(result.risks, answer.risks)
})
