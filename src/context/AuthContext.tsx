import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../lib/auth'

interface AuthContextValue {
  isLoading: boolean
  isAuthenticated: boolean
  username: string | null
  login: (login: string, password: string) => Promise<string | null>
  register: (login: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isActive = true
    getCurrentUser()
      .then((user) => {
        if (isActive) setUsername(user?.username ?? null)
      })
      .catch(() => {
        if (isActive) setUsername(null)
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })
    return () => {
      isActive = false
    }
  }, [])

  const login = useCallback(async (loginName: string, password: string): Promise<string | null> => {
    const trimmed = loginName.trim()
    if (!trimmed || !password.trim()) {
      return 'Введите логин и пароль'
    }
    try {
      const user = await loginUser(trimmed, password)
      setUsername(user.username)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Не удалось войти'
    }
  }, [])

  const register = useCallback(async (loginName: string, password: string): Promise<string | null> => {
    const trimmed = loginName.trim()
    if (!trimmed || !password.trim()) {
      return 'Введите логин и пароль'
    }
    try {
      const user = await registerUser(trimmed, password)
      setUsername(user.username)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Не удалось зарегистрироваться'
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } finally {
      setUsername(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated: username !== null,
        username,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
