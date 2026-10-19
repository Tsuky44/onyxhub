import type { ServiceDefinition } from './registry'

export type ServiceStatus = 'configured' | 'partial' | 'empty'

/** Configuré si tous les champs obligatoires ont une valeur, vide si aucun, partiel sinon. */
export function serviceStatus(service: ServiceDefinition, isSet: (key: string) => boolean): ServiceStatus {
  const required = service.fields.filter((field) => !field.optional)
  const filled = required.filter((field) => isSet(field.key)).length
  if (filled === required.length) return 'configured'
  return filled === 0 && !service.fields.some((field) => isSet(field.key)) ? 'empty' : 'partial'
}
