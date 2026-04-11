import { createContext, useContext } from 'react'
import { useDashboardData } from '@/hooks/useDashboardData'

type DashboardContextType = ReturnType<typeof useDashboardData>

export const DashboardContext = createContext<DashboardContextType | null>(null)

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const data = useDashboardData()
  return <DashboardContext.Provider value={data}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
