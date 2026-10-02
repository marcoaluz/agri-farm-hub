export function getNotificationDestination(tipo?: string | null, linkAcao?: string | null) {
  if (tipo === 'sanitario_lembrete') return '/pecuaria?tab=sanidade'
  if (tipo === 'agenda_lembrete') return '/agenda?aba=minha'
  if (tipo === 'agenda_convite') return '/agenda?aba=minha'
  return linkAcao || null
}