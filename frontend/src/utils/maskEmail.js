/**
 * "username@gmail.com" -> "u*******@gmail.com". Mirrors the backend's
 * maskEmail() so an address is displayed the same way whether it came
 * from the API or from what the user just typed.
 */
export const maskEmail = (email) => {
  if (typeof email !== 'string') return '';
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.length > 1 ? local[0] : '';
  const stars = '*'.repeat(Math.min(Math.max(local.length - visible.length, 3), 8));
  return `${visible}${stars}@${domain}`;
};

export default maskEmail;
