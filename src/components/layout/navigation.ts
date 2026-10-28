import {
  Apple,
  Bot,
  Dumbbell,
  LayoutDashboard,
  Settings,
  TrendingUp,
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
  { label: 'Progress', icon: TrendingUp, href: '/progress' },
  { label: 'Nutrition', icon: Apple, href: '/nutrition' },
  { label: 'AI Logger', icon: Bot, href: '/ai-logger' },
  { label: 'Settings', icon: Settings, href: '/settings' },
]
