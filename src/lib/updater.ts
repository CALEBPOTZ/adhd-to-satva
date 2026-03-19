// App version auto-update checker
// On each build, a version.json is generated with the build timestamp
// On app open, we fetch it and compare to the cached version

const VERSION_KEY = 'adhd_satva_version'
const CHECK_INTERVAL = 5 * 60 * 1000 // Check every 5 minutes

export interface UpdateState {
  updateAvailable: boolean
  checking: boolean
}

export async function checkForUpdate(): Promise<boolean> {
  try {
    // Bust cache with timestamp
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return false

    const { version } = await res.json()
    const cached = localStorage.getItem(VERSION_KEY)

    if (!cached) {
      // First visit — just store the version
      localStorage.setItem(VERSION_KEY, version)
      return false
    }

    if (cached !== version) {
      return true // New version available!
    }

    return false
  } catch {
    return false
  }
}

export function acceptUpdate() {
  // Clear the cached version so after reload we store the new one
  localStorage.removeItem(VERSION_KEY)
  window.location.reload()
}

export function startUpdateChecker(onUpdate: () => void) {
  // Check on load
  checkForUpdate().then(available => {
    if (available) onUpdate()
  })

  // Check periodically
  setInterval(async () => {
    const available = await checkForUpdate()
    if (available) onUpdate()
  }, CHECK_INTERVAL)
}
