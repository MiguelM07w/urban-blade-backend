/**
 * Ofusca un email para registrarlo en logs sin exponer el dato completo (PII).
 * Conserva el primer y último carácter del usuario y el dominio, enmascarando el
 * resto. Ej: "mena60121@gmail.com" → "m***1@gmail.com". Entradas atípicas se
 * ofuscan de forma conservadora en vez de fallar.
 */
export function maskEmail(email: string): string {
  if (typeof email !== 'string' || !email.includes('@')) {
    return '***';
  }
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0] ?? '*'}***@${domain}`;
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}
