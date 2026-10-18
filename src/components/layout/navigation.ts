import {
  Apple,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Dumbbell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavigationItem = {
  label: string
  icon: LucideIcon
  href?: string
}

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Workouts', icon: Dumbbell, href: '/workouts' },
  { label: 'Nutrition', icon: Apple, href: '/nutrition' },
  { label: 'Progress', icon: TrendingUp, href: '/progress' },
  { label: 'Settings', icon: Settings, href: '/settings/data' },
]
