export function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index % Math.max(1, a.length)) || 0)
      ^ (b.charCodeAt(index % Math.max(1, b.length)) || 0);
  }
  return difference === 0;
}

export function parseBasicAuthorization(value) {
  if (!value || !value.startsWith('Basic ')) return null;
  try {
    const decoded = atob(value.slice(6));
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return {username: decoded.slice(0, separator), password: decoded.slice(separator + 1)};
  } catch {
    return null;
  }
}

export function authorizeAdmin(value, environment = process.env) {
  const username = environment.PV_ADMIN_USERNAME;
  const password = environment.PV_ADMIN_PASSWORD;
  if (!username || !password) return {authorized: false, configured: false};
  const supplied = parseBasicAuthorization(value);
  return {
    authorized: Boolean(supplied)
      && constantTimeEqual(supplied.username, username)
      && constantTimeEqual(supplied.password, password),
    configured: true,
  };
}
