export interface AuthUser {
  username: string
}

interface UserResponse {
  user: AuthUser
}

interface ErrorResponse {
  error?: string
}

export class AuthApiError extends Error {}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: options?.body
        ? { 'Content-Type': 'application/json', ...options.headers }
        : options?.headers,
    })
  } catch {
    throw new AuthApiError('Сервер недоступен. Попробуйте ещё раз')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorResponse
    throw new AuthApiError(body.error || 'Не удалось выполнить запрос')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await request<UserResponse>('/api/auth/me')
    return response.user
  } catch (error) {
    if (error instanceof AuthApiError && error.message === 'Не авторизован') return null
    throw error
  }
}

export async function loginUser(username: string, password: string): Promise<AuthUser> {
  const response = await request<UserResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  return response.user
}

export async function registerUser(username: string, password: string): Promise<AuthUser> {
  const response = await request<UserResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  return response.user
}

export async function logoutUser(): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST' })
}
