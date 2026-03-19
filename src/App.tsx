import { useState, useEffect, useCallback, useRef } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { UserContext } from './hooks/useUser'
import { ComboContext, getComboMultiplier, shouldResetCombo } from './hooks/useCombo'
import { playCombo } from './lib/sounds'
import { runNotificationChecks, requestNotificationPermission } from './lib/notifications'
import { startUpdateChecker } from './lib/updater'
import { UserSwitcher } from './components/UserSwitcher'
import { UserPicker } from './components/UserPicker'
import { ComboMeter } from './components/ComboMeter'
import { UpdateBanner } from './components/UpdateBanner'
import { Home } from './pages/Home'
import { Tasks } from './pages/Tasks'
import { Sadhana } from './pages/Sadhana'
import { Profile } from './pages/Profile'
import { Rewards } from './pages/Rewards'
import type { User } from './types'

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/tasks', label: 'Tasks', icon: '📋' },
  { path: '/sadhana', label: 'Sadhana', icon: '🙏' },
  { path: '/rewards', label: 'Shop', icon: '🎁' },
  { path: '/profile', label: 'Profile', icon: '👤' },
]

// Unique device ID — persists forever so each phone remembers its user
function getDeviceId(): string {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('device_id', id)
  }
  return id
}

function App() {
  const [users, setUsers] = useState<User[]>([])
  const [currentIndex, setCurrentIndex] = useState<number | null>(() => {
    const saved = localStorage.getItem(`user_${getDeviceId()}`)
    return saved !== null ? parseInt(saved) : null
  })
  const [loading, setLoading] = useState(true)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  // Check for app updates
  useEffect(() => {
    startUpdateChecker(() => setUpdateAvailable(true))
  }, [])

  // Global combo state
  const [combo, setCombo] = useState(0)
  const [lastCompletionTime, setLastCompletionTime] = useState<number | null>(null)
  const comboResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const registerCompletion = useCallback(() => {
    if (comboResetTimer.current) clearTimeout(comboResetTimer.current)

    const newCombo = shouldResetCombo(lastCompletionTime) ? 1 : combo + 1
    setCombo(newCombo)
    setLastCompletionTime(Date.now())

    if (newCombo >= 2) playCombo()

    comboResetTimer.current = setTimeout(() => {
      setCombo(0)
      setLastCompletionTime(null)
    }, 120_000)

    return getComboMultiplier(newCombo)
  }, [combo, lastCompletionTime])

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('name')
    if (data && data.length > 0) {
      setUsers(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // Real-time user updates (XP, level, etc.)
  useEffect(() => {
    const channel = supabase
      .channel('user-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchUsers])

  // Notification system
  useEffect(() => {
    if (currentIndex === null) return
    const currentUser = users[currentIndex]
    if (!currentUser) return
    requestNotificationPermission()
    runNotificationChecks(currentUser.id)
    const interval = setInterval(() => {
      runNotificationChecks(currentUser.id)
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [users, currentIndex])

  const pickUser = useCallback((index: number) => {
    setCurrentIndex(index)
    localStorage.setItem(`user_${getDeviceId()}`, String(index))
  }, [])

  const switchUser = useCallback(() => {
    const next = ((currentIndex ?? 0) + 1) % users.length
    pickUser(next)
  }, [currentIndex, users.length, pickUser])

  const refreshUser = useCallback(async () => {
    await fetchUsers()
  }, [fetchUsers])

  const currentUser = currentIndex !== null ? (users[currentIndex] || null) : null
  const otherUser = currentIndex !== null && users.length > 1
    ? users[((currentIndex) + 1) % users.length]
    : null

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔥</div>
          <div className="text-text-dim">Loading...</div>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="text-2xl font-bold mb-2">ADHD to Satva</h1>
          <p className="text-text-dim mb-4">
            Connect to Supabase to get started.
          </p>
        </div>
      </div>
    )
  }

  // Show user picker if no user selected on this device
  if (currentIndex === null || !currentUser) {
    return <UserPicker users={users} onPick={pickUser} />
  }

  return (
    <UserContext.Provider value={{ currentUser, otherUser, switchUser, refreshUser }}>
      <ComboContext.Provider value={{ combo, lastCompletionTime, registerCompletion }}>
        <BrowserRouter basename="/adhd-to-satva">
          {updateAvailable && <UpdateBanner />}
          <div className="min-h-screen flex flex-col max-w-lg mx-auto">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-lg border-b border-bg-elevated px-4 py-3">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold bg-gradient-to-r from-accent to-accent-glow bg-clip-text text-transparent">
                  ADHD to Satva
                </h1>
                <UserSwitcher />
              </div>
              {combo >= 2 && (
                <div className="mt-2">
                  <ComboMeter />
                </div>
              )}
            </header>

            {/* Content */}
            <main className="flex-1 p-4 pb-24">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/sadhana" element={<Sadhana />} />
                <Route path="/rewards" element={<Rewards />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </main>

            {/* Bottom nav */}
            <nav className="fixed bottom-0 left-0 right-0 z-30 bg-bg-card/90 backdrop-blur-lg border-t border-bg-elevated">
              <div className="max-w-lg mx-auto flex">
                {NAV_ITEMS.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex-1 flex flex-col items-center py-3 text-xs transition-colors
                       ${isActive ? 'text-accent' : 'text-text-dim'}`
                    }
                  >
                    <span className="text-xl mb-0.5">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </BrowserRouter>
      </ComboContext.Provider>
    </UserContext.Provider>
  )
}

export default App
