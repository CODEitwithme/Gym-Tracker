import { describe, expect, it } from 'vitest'
import { navigationItems } from './navigation'

describe('navigationItems', () => {
  it('includes AI Logger in primary navigation', () => {
    const aiLoggerItem = navigationItems.find((item) => item.label === 'AI Logger')
    expect(aiLoggerItem).toBeDefined()
    expect(aiLoggerItem?.href).toBe('/ai-logger')
  })

  it('includes Settings pointing to /settings', () => {
    const settingsItem = navigationItems.find((item) => item.label === 'Settings')
    expect(settingsItem).toBeDefined()
    expect(settingsItem?.href).toBe('/settings')
  })

  it('includes Dashboard pointing to root', () => {
    const dashboardItem = navigationItems.find((item) => item.label === 'Dashboard')
    expect(dashboardItem).toBeDefined()
    expect(dashboardItem?.href).toBe('/')
  })
})

