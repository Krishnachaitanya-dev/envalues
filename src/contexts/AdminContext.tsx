import { createContext, useContext } from 'react'
import { useAdminData } from '@/hooks/useAdminData'

type AdminContextType = ReturnType<typeof useAdminData>

const AdminContext = createContext<AdminContextType | null>(null)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const data = useAdminData()
  return <AdminContext.Provider value={data}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
