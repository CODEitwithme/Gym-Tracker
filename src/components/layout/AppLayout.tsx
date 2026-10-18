import { Outlet } from 'react-router-dom'
import BottomNavigation from './BottomNavigation'
import Header from './Header'
import Sidebar from './Sidebar'

function AppLayout() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Sidebar />
      <div className="min-h-screen lg:pl-64">
        <Header />
        <Outlet />
      </div>
      <BottomNavigation />
    </div>
  )
}

export default AppLayout
