const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { spawn } = require('child_process')

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'qwen3:4b-instruct'
const OLLAMA_INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe'

function normalizeEndpoint(value = DEFAULT_ENDPOINT) {
  const url = new URL(String(value || DEFAULT_ENDPOINT))
  const host = url.hostname.toLowerCase()
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('Lokalne AI może łączyć się wyłącznie z tym komputerem.')
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Nieobsługiwany adres lokalnego AI.')
  return url.origin
}

function normalizeConfig(config = {}) {
  return {
    enabled: config.enabled === true,
    autoAudit: config.autoAudit === true,
    endpoint: normalizeEndpoint(config.endpoint),
    model: String(config.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  }
}

function request(endpoint, route, options = {}) {
  const base = new URL(normalizeEndpoint(endpoint))
  const target = new URL(route, `${base.origin}/`)
  const client = target.protocol === 'https:' ? https : http
  const body = options.body == null ? null : Buffer.from(JSON.stringify(options.body))
  return new Promise((resolve, reject) => {
    const req = client.request(target, {
      method: options.method || (body ? 'POST' : 'GET'),
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': body.length } : {},
      timeout: options.timeout || 8000
    }, response => {
      const chunks = []
      response.on('data', chunk => {
        chunks.push(chunk)
        if (options.onChunk) options.onChunk(chunk.toString('utf8'))
      })
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if ((response.statusCode || 500) >= 400) return reject(new Error(`Ollama HTTP ${response.statusCode}: ${text.slice(0, 300)}`))
        resolve({ status: response.statusCode, text, json: () => text ? JSON.parse(text) : {} })
      })
    })
    req.on('timeout', () => req.destroy(new Error('Lokalne AI nie odpowiedziało w wymaganym czasie.')))
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function status(config = {}) {
  const cfg = normalizeConfig(config)
  try {
    const response = await request(cfg.endpoint, '/api/tags', { timeout: 2500 })
    const models = (response.json().models || []).map(item => ({ name: item.name || item.model, size: Number(item.size || 0), details: item.details || {} }))
    const installed = models.some(item => item.name === cfg.model || item.name === `${cfg.model}:latest` || item.name?.split(':')[0] === cfg.model?.split(':')[0] && cfg.model.endsWith(':latest'))
    return { ...cfg, running: true, installed, ready: cfg.enabled && installed, models }
  } catch (error) {
    return { ...cfg, running: false, installed: false, ready: false, models: [], error: error.message }
  }
}

async function pullModel(config = {}, onProgress = () => {}) {
  const cfg = normalizeConfig(config)
  let pending = ''
  const progress = text => {
    pending += text
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const item = JSON.parse(line)
        const percent = item.total ? Math.max(0, Math.min(100, Math.round(Number(item.completed || 0) / Number(item.total) * 100))) : null
        onProgress({ stage: 'MODEL', model: cfg.model, status: item.status || 'Pobieranie modelu', percent })
      } catch {}
    }
  }
  await request(cfg.endpoint, '/api/pull', { method: 'POST', body: { name: cfg.model, stream: true }, timeout: 60 * 60 * 1000, onChunk: progress })
  onProgress({ stage: 'READY', model: cfg.model, status: 'Model jest gotowy', percent: 100 })
  return status({ ...cfg, enabled: true })
}

function isTokenRepeatError(error) {
  return /prediction aborted|token repeat limit reached/i.test(String(error?.message || error || ''))
}

function isEmptyModelError(error) {
  return error?.code === 'EMPTY_AI_RESPONSE'
}

function chatBody(config, messages, format, retry = false) {
  const retryInstruction = retry
    ? `\nNie powtarzaj zdań ani fragmentów odpowiedzi. Zakończ odpowiedź po wypełnieniu wymaganej struktury.${format && typeof format === 'object' ? ` Wymagany schemat JSON: ${JSON.stringify(format)}` : ''}`
    : ''
  const body = {
    model: config.model,
    messages: messages.map(message => ({
      role: message.role,
      content: `${String(message.content || '')}${retry && message.role === 'system' ? retryInstruction : ''}`
    })),
    stream: false,
    think: false,
    keep_alive: '10m',
    options: retry
      ? { temperature: 0.75, top_p: 0.9, num_ctx: 8192, num_predict: 900 }
      : { temperature: 0.65, top_p: 0.9, num_ctx: 8192, num_predict: 1200 }
  }
  if (format) body.format = retry && typeof format === 'object' ? 'json' : format
  return body
}

async function chat(config = {}, messages = [], format = null) {
  const cfg = normalizeConfig(config)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await request(cfg.endpoint, '/api/chat', { method: 'POST', body: chatBody(cfg, messages, format, attempt === 1), timeout: 8 * 60 * 1000 })
      const payload = response.json()
      const content = String(payload.message?.content || '').trim()
      if (!content) {
        const emptyError = new Error('Lokalny model zwrócił pustą odpowiedź.')
        emptyError.code = 'EMPTY_AI_RESPONSE'
        throw emptyError
      }
      return { content, model: payload.model || cfg.model, metrics: { promptTokens: payload.prompt_eval_count || 0, responseTokens: payload.eval_count || 0 } }
    } catch (error) {
      const retryable = isTokenRepeatError(error) || isEmptyModelError(error)
      if (attempt === 0 && retryable) continue
      if (isTokenRepeatError(error)) throw new Error('Lokalny model zapętlił odpowiedź. Uruchom analizę ponownie; jeżeli problem wraca, wybierz większy model w Ustawieniach lokalnego AI.')
      if (isEmptyModelError(error)) throw new Error('Lokalny model nie utworzył odpowiedzi. Uruchom analizę ponownie albo zaktualizuj Ollamę w Ustawieniach lokalnego AI.')
      throw error
    }
  }
}

function parseJsonResponse(result) {
  try { return JSON.parse(result.content) } catch {
    const match = result.content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Model nie zwrócił poprawnej struktury odpowiedzi.')
    return JSON.parse(match[0])
  }
}

async function analyzeRepair(config, context) {
  const schema = {
    type: 'object',
    properties: {
      summary: { type: 'string' }, confidence: { type: 'string', enum: ['NISKA', 'ŚREDNIA', 'WYSOKA'] },
      hypotheses: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, reason: { type: 'string' }, confidence: { type: 'string' }, checks: { type: 'array', items: { type: 'string' } } }, required: ['title', 'reason', 'confidence', 'checks'] } },
      next_tests: { type: 'array', items: { type: 'string' } }, questions: { type: 'array', items: { type: 'string' } }, cautions: { type: 'array', items: { type: 'string' } }
    }, required: ['summary', 'confidence', 'hypotheses', 'next_tests', 'questions', 'cautions']
  }
  const system = `Jesteś lokalnym asystentem diagnostycznym polskiego warsztatu samochodowego. Odpowiadasz po polsku. Tworzysz hipotezy i plan pomiarów, nigdy nie przedstawiasz przypuszczenia jako potwierdzonej usterki. Uwzględniaj wyłącznie przekazane dane. Najpierw proponuj testy bezpieczne, szybkie i rozstrzygające. Nie wymyślaj momentów dokręcania ani wartości producenta. Zwróć wyłącznie JSON zgodny ze schematem.`
  const result = await chat(config, [{ role: 'system', content: system }, { role: 'user', content: `Przeanalizuj zlecenie:\n${JSON.stringify(context, null, 2)}` }], schema)
  return { ...parseJsonResponse(result), model: result.model, metrics: result.metrics }
}

async function analyzeInterface(config, snapshot) {
  const system = `Jesteś audytorem UX aplikacji warsztatowej AutoLogika OS. Analizujesz wyłącznie semantyczny opis widoku bez wartości pól formularzy. Odpowiadasz po polsku, konkretnie i krótko. Wskaż problemy możliwe do wywnioskowania z danych: przepełnienie, zbyt wiele akcji, brak jasnej hierarchii, małe cele dotykowe, blokujące błędy. Nie wymyślaj elementów, których nie ma. Format: najpierw ocena, potem lista priorytetów P1/P2/P3 i konkretna rekomendacja.`
  return chat(config, [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(snapshot, null, 2) }])
}

async function analyzeWorkflow(config, context) {
  const schema = { type: 'object', properties: {
    summary: { type: 'string' }, current_stage: { type: 'string' },
    next_actions: { type: 'array', items: { type: 'string' } }, risks: { type: 'array', items: { type: 'string' } },
    missing_data: { type: 'array', items: { type: 'string' } }, cost_controls: { type: 'array', items: { type: 'string' } }
  }, required: ['summary', 'current_stage', 'next_actions', 'risks', 'missing_data', 'cost_controls'] }
  const system = `Jesteś lokalnym koordynatorem procesu naprawy w polskim warsztacie. Sprawdzasz spójność zlecenia od przyjęcia przez diagnozę, zakres, części, wycenę, akceptację, naprawę, QC, płatność i wydanie. Nie zmieniasz danych. Wskazujesz maksymalnie 5 konkretnych następnych działań, wykryte ryzyka i brakujące dane. Nie uznawaj części za zamontowaną ani diagnozy za potwierdzoną bez zapisu. Odpowiadaj po polsku i zwróć wyłącznie JSON zgodny ze schematem.`
  const result = await chat(config, [{ role: 'system', content: system }, { role: 'user', content: `Oceń aktualny stan zlecenia:\n${JSON.stringify(context, null, 2)}` }], schema)
  return { ...parseJsonResponse(result), model: result.model, metrics: result.metrics }
}

function feedbackDirectory(documentsPath) { return path.join(documentsPath, 'AutoLogika', 'AI Feedback') }
function feedbackPath(documentsPath, date = new Date()) { return path.join(feedbackDirectory(documentsPath), `AutoLogika-AI-feedback-${date.toISOString().slice(0, 10)}.txt`) }
function appendFeedback(documentsPath, entry) {
  const directory = feedbackDirectory(documentsPath)
  fs.mkdirSync(directory, { recursive: true })
  const file = feedbackPath(documentsPath)
  const block = [`\n${'='.repeat(78)}`, `Data: ${new Date().toLocaleString('pl-PL')}`, `Widok: ${entry.page || 'nieznany'}`, `Model: ${entry.model || 'nieznany'}`, '', String(entry.content || '').trim(), ''].join('\n')
  fs.appendFileSync(file, block, 'utf8')
  return file
}

function findOllamaExecutable(env = process.env) {
  const candidates = [
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Ollama', 'ollama.exe')
  ].filter(Boolean)
  return candidates.find(candidate => fs.existsSync(candidate)) || ''
}

function startOllama(executable = findOllamaExecutable()) {
  if (!executable) return false
  const child = spawn(executable, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
  return true
}

function downloadFile(url, destination, onProgress = () => {}, redirects = 0) {
  if (redirects > 5) return Promise.reject(new Error('Zbyt wiele przekierowań podczas pobierania Ollamy.'))
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume()
        return resolve(downloadFile(new URL(response.headers.location, url).toString(), destination, onProgress, redirects + 1))
      }
      if (response.statusCode !== 200) { response.resume(); return reject(new Error(`Nie udało się pobrać instalatora Ollamy (HTTP ${response.statusCode}).`)) }
      const total = Number(response.headers['content-length'] || 0)
      let completed = 0
      const stream = fs.createWriteStream(destination)
      response.on('data', chunk => { completed += chunk.length; onProgress({ stage: 'INSTALLER', status: 'Pobieranie instalatora Ollamy', percent: total ? Math.round(completed / total * 100) : null }) })
      response.pipe(stream)
      stream.on('finish', () => stream.close(() => resolve(destination)))
      stream.on('error', reject)
    }).on('error', reject)
  })
}

function runInstaller(installerPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(installerPath, [], { windowsHide: false, stdio: 'ignore' })
    child.once('error', reject)
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Instalator Ollamy zakończył pracę z kodem ${code}.`)))
  })
}

async function waitForServer(config, timeoutMs = 45000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const current = await status(config)
    if (current.running) return current
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error('Ollama została zainstalowana, ale lokalny serwer nie uruchomił się na czas.')
}

module.exports = { DEFAULT_ENDPOINT, DEFAULT_MODEL, OLLAMA_INSTALLER_URL, normalizeConfig, status, pullModel, chat, analyzeRepair, analyzeWorkflow, analyzeInterface, appendFeedback, feedbackDirectory, feedbackPath, findOllamaExecutable, startOllama, downloadFile, runInstaller, waitForServer, isTokenRepeatError }
