import assert from 'node:assert/strict'
import test from 'node:test'
import { nextThemePreference, normalizeThemePreference, resolveTheme } from '../src/lib/theme.js'

test('normalizes unknown theme preferences to system', () => {
  assert.equal(normalizeThemePreference('sepia'), 'system')
  assert.equal(normalizeThemePreference('dark'), 'dark')
})

test('system theme follows the operating system while explicit themes do not', () => {
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
  assert.equal(resolveTheme('light', true), 'light')
})

test('cycles system, light, and dark preferences', () => {
  assert.equal(nextThemePreference('system'), 'light')
  assert.equal(nextThemePreference('light'), 'dark')
  assert.equal(nextThemePreference('dark'), 'system')
})
