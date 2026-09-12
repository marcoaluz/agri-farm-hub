export function getNotificationDestination(tipo?: string | null, linkAcao?: string | null) {
  if (tipo === 'sanitario_lembrete') return '/pecuaria?tab=sanidade'
  return linkAcao || null
}