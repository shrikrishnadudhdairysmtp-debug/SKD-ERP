import jwt from 'jsonwebtoken';

function getJwtSecret() {
  return process.env.JWT_SECRET || 'skd-erp-fallback-secret-key-2026';
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.userId, name: user.name, role: user.role, permissions: user.permissions },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

export function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded;
  } catch (err) {
    throw new Error('Unauthorized: Invalid or expired token');
  }
}

export function requireRole(user, ...roles) {
  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: Requires one of roles: ${roles.join(', ')}`);
  }
}
