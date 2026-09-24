const WORKSHOP_LAYOUT_KEY = 'workshop_layout_v1'
const WORKSHOP_LAYOUT_CLOUD_ID = 'workshop-layout-v1'

const DEFAULT_WORKSHOP_LAYOUT = Object.freeze({
  bays: Object.freeze(['Stanowisko 1', 'Stanowisko 2', 'Diagnostyka', 'Plac / oczekuje']),
  openingHour: 8,
  closingHour: 18,
  defaultAppointmentMinutes: 60
})

const clamp = (value, min, max, fallback) => {
  const number = Math.round(Number(value))
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback
}

function normalizeWorkshopLayout(input = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const names = Array.isArray(source.bays)
    ? source.bays.map(value => String(value || '').trim()).filter(Boolean)
    : [...DEFAULT_WORKSHOP_LAYOUT.bays]
  const uniqueBays = [...new Set(names)].slice(0, 20)
  const openingHour = clamp(source.openingHour, 0, 22, DEFAULT_WORKSHOP_LAYOUT.openingHour)
  const closingHour = clamp(source.closingHour, openingHour + 1, 24, DEFAULT_WORKSHOP_LAYOUT.closingHour)
  return {
    bays: uniqueBays.length ? uniqueBays : [...DEFAULT_WORKSHOP_LAYOUT.bays],
    openingHour,
    closingHour,
    defaultAppointmentMinutes: clamp(source.defaultAppointmentMinutes, 15, 480, DEFAULT_WORKSHOP_LAYOUT.defaultAppointmentMinutes)
  }
}

function parseWorkshopLayout(value) {
  try { return normalizeWorkshopLayout(typeof value === 'string' ? JSON.parse(value) : value) }
  catch { return normalizeWorkshopLayout() }
}

function getWorkshopLayout(db) {
  const row = db.prepare('SELECT value FROM app_settings WHERE setting_key=? LIMIT 1').get(WORKSHOP_LAYOUT_KEY)
  return parseWorkshopLayout(row?.value)
}

function setWorkshopLayout(db, value) {
  const layout = normalizeWorkshopLayout(value)
  db.prepare(`INSERT INTO app_settings(setting_key,value,cloud_id,updated_at)
    VALUES (?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value,cloud_id=COALESCE(app_settings.cloud_id,excluded.cloud_id),updated_at=CURRENT_TIMESTAMP`)
    .run(WORKSHOP_LAYOUT_KEY, JSON.stringify(layout), WORKSHOP_LAYOUT_CLOUD_ID)
  return layout
}

module.exports = { WORKSHOP_LAYOUT_KEY, WORKSHOP_LAYOUT_CLOUD_ID, DEFAULT_WORKSHOP_LAYOUT, normalizeWorkshopLayout, parseWorkshopLayout, getWorkshopLayout, setWorkshopLayout }
