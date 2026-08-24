export function resolveServerHost(host: string | undefined): string {
  return host?.trim() || '0.0.0.0'
}
