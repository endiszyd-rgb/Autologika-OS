const test = require('node:test')
const assert = require('node:assert/strict')
const { DEFAULT_WORKSHOP_LAYOUT, normalizeWorkshopLayout, parseWorkshopLayout } = require('../electron/workshop-settings.cjs')

test('ustawienia warsztatu usuwają puste i powtórzone stanowiska', () => {
  const result = normalizeWorkshopLayout({ bays: [' Podnośnik A ', '', 'Podnośnik A', 'Geometria'], openingHour: 7, closingHour: 20, defaultAppointmentMinutes: 90 })
  assert.deepEqual(result, { bays: ['Podnośnik A', 'Geometria'], openingHour: 7, closingHour: 20, defaultAppointmentMinutes: 90 })
})

test('nieprawidłowa konfiguracja wraca do bezpiecznych wartości', () => {
  const result = parseWorkshopLayout('{niepoprawny json')
  assert.deepEqual(result.bays, [...DEFAULT_WORKSHOP_LAYOUT.bays])
  assert.equal(result.openingHour, 8)
  assert.equal(result.closingHour, 18)
  assert.equal(result.defaultAppointmentMinutes, 60)
})

test('godziny i czas wizyty są ograniczane do obsługiwanego zakresu', () => {
  const result = normalizeWorkshopLayout({ bays: ['A'], openingHour: 22, closingHour: 4, defaultAppointmentMinutes: 999 })
  assert.equal(result.openingHour, 22)
  assert.equal(result.closingHour, 23)
  assert.equal(result.defaultAppointmentMinutes, 480)
})
