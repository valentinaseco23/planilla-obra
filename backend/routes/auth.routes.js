const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

const router = express.Router();

router.post('/login', async (req, res) => {
  const { nombre_usuario, password } = req.body;
  
  if (!nombre_usuario || !password) {
    return res.status(400).json({ error: 'El nombre de usuario y el password son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, nombre_usuario, password_hash, rol, activo FROM usuario WHERE nombre_usuario = $1',
      [nombre_usuario]
    );
    const usuario = rows[0];

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordOk = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, nombre_usuario: usuario.nombre_usuario, rol: usuario.rol },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

module.exports = router;