import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isRegister = mode === 'register'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!loginName.trim() || !password.trim()) {
      setError('Введите логин и пароль')
      return
    }
    if (isRegister && password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setIsSubmitting(true)
    const nextError = isRegister
      ? await register(loginName, password)
      : await login(loginName, password)
    setError(nextError)
    setIsSubmitting(false)
  }

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register')
    setPassword('')
    setConfirmPassword('')
    setError(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-indigo-600"
          >
            <path d="M12 20h9" />
            <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
            <path d="M15 5l3 3" />
          </svg>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">ТЗ-Ассистент</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isRegister ? 'Создайте аккаунт, чтобы начать' : 'Войдите, чтобы продолжить'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login" className="mb-1.5 block text-sm font-medium text-slate-700">
              Логин
            </label>
            <input
              id="login"
              type="text"
              autoComplete="username"
              value={loginName}
              disabled={isSubmitting}
              onChange={(e) => {
                setLoginName(e.target.value)
                setError(null)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Введите логин"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              disabled={isSubmitting}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Введите пароль"
            />
          </div>

          {isRegister && (
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Подтвердите пароль
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                disabled={isSubmitting}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setError(null)
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="Повторите пароль"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? isRegister ? 'Создаём аккаунт…' : 'Входим…'
              : isRegister ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
          <button
            type="button"
            onClick={switchMode}
            disabled={isSubmitting}
            className="font-semibold text-indigo-600 transition hover:text-indigo-700 disabled:opacity-60"
          >
            {isRegister ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </p>
      </div>
    </div>
  )
}
