/** Assemble des classes conditionnelles, sans dépendance pour si peu. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
