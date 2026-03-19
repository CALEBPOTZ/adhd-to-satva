import { Dashboard } from '../components/Dashboard'
import { ProgressDashboard } from '../components/ProgressDashboard'

export function Home() {
  return (
    <div className="space-y-6">
      <Dashboard />
      <ProgressDashboard />
    </div>
  )
}
