import { useEffect, useState } from 'react'
import {
  getUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from '../lib/userPreferences'

export function useUserPreferences(): [
  UserPreferences,
  (updates: Partial<UserPreferences>) => void,
] {
  const [preferences, setPreferences] = useState<UserPreferences>(getUserPreferences)

  useEffect(() => {
    const handleChanged = () => {
      setPreferences(getUserPreferences())
    }

    window.addEventListener('forge-fit-preferences-changed', handleChanged)
    window.addEventListener('storage', handleChanged)

    return () => {
      window.removeEventListener('forge-fit-preferences-changed', handleChanged)
      window.removeEventListener('storage', handleChanged)
    }
  }, [])

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    const next = saveUserPreferences(updates)
    setPreferences(next)
  }

  return [preferences, updatePreferences]
}
