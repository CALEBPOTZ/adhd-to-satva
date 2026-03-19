import { Dashboard } from '../components/Dashboard'
import { ProgressDashboard } from '../components/ProgressDashboard'
import { useDate } from '../hooks/useDate'

export function Home() {
  const { isToday } = useDate()

  return (
    <div className="space-y-6">
      <Dashboard />
      {isToday && <ProgressDashboard />}
    </div>
  )
}
