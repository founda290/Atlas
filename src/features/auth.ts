export interface AccountFields {
  name: string
  email: string
  password: string
  confirm: string
  terms: boolean
}
export type AccountErrors = Partial<Record<keyof AccountFields, string>>
export function validateAccount(fields: AccountFields, signup: boolean): AccountErrors {
  const errors: AccountErrors = {}
  if (signup && !fields.name.trim()) errors.name = 'Enter your name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errors.email = 'Enter a valid email address.'
  if (!fields.password) errors.password = 'Enter your password.'
  else if (signup && fields.password.length < 12) errors.password = 'Use at least 12 characters.'
  if (signup && fields.confirm !== fields.password) errors.confirm = 'Passwords must match.'
  if (signup && !fields.terms)
    errors.terms = 'Acknowledge the local preview limitations to continue.'
  return errors
}
