const jwt = require('jsonwebtoken');
require('dotenv').config();

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no provisto' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tenés permisos para esta acción' });
    }
    next();
  };
}

function requireEncargado(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'encargado') {
    return res.status(403).json({ error: 'Esta acción requiere sesión de encargado' });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireEncargado };
