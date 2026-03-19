import { createContext, useContext } from 'react'

interface DateContextType {
  date: string          // ISO date string
  isToday: boolean
  isYesterday: boolean
  setToday: () => void
  setYesterday: () => void
}

function getToday() { return new Date().toISOString().split('T')[0] }
function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export const DateContext = createContext<DateContextType>({
  date: getToday(),
  isToday: true,
  isYesterday: false,
  setToday: () => {},
  setYesterday: () => {},
})

export function useDate() {
  return useContext(DateContext)
}

export { getToday, getYesterday }
