import { createContext, useContext } from 'react'
import type { User } from '../types'

interface UserContextType {
  currentUser: User | null
  otherUser: User | null
  switchUser: () => void
  refreshUser: () => Promise<void>
}

export const UserContext = createContext<UserContextType>({
  currentUser: null,
  otherUser: null,
  switchUser: () => {},
  refreshUser: async () => {},
})

export function useUser() {
  return useContext(UserContext)
}
