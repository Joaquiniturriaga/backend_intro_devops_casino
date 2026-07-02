// ============================================================
// API REST del Casino Online - Experiencia 2 (DevOps)
// ============================================================
const express = require('express');
const cors = require('cors');
const { pool, esperarBD } = require('./db/pool');
const { sembrarUsuariosDemo } = require('./db/seed');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(s => s.trim())
}));
app.use(express.json({ limit: '1mb' }));

// /health — endpoint de salud que verifica la conexión a la BD.
// Docker usa este endpoint en HEALTHCHECK; también lo utilizan ALB/ELB en AWS
// y los pipelines de CI/CD para saber si el servicio está listo para recibir tráfico.
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err.message });
  }
});

// ── Sondas de salud para Kubernetes (referencia para los microservicios) ────
// Distinción clave entre las dos probes:
//   • liveness  → ¿el proceso está vivo? NO depende de la BD. Si falla, k8s
//                 REINICIA el pod.
//   • readiness → ¿listo para recibir tráfico? Verifica la BD. Si falla, k8s
//                 SACA el pod del balanceo (sin reiniciarlo) hasta que sane.
app.get('/livez', (req, res) => {
  res.json({ status: 'alive', uptime: process.uptime() });
});

app.get('/readyz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', db: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', db: 'down', error: err.message });
  }
});

// Bienvenida
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Casino Online',
    version: '1.0.0',
    endpoints: ['/api/auth', '/api/usuarios/me', '/api/juegos', '/api/transacciones']
  });
});

// Rutas de la API
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/usuarios',      require('./routes/users'));
app.use('/api/juegos',        require('./routes/games'));
app.use('/api/transacciones', require('./routes/transactions'));

// Manejador global de errores (cuatro parámetros = Express lo identifica como error handler).
// Captura errores síncronos y los que llegan por next(err) en las rutas.
app.use((err, req, res, next) => {
  console.error('[ERR]', err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno' });
});

(async () => {
  await esperarBD();
  await sembrarUsuariosDemo();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API] Casino escuchando en http://0.0.0.0:${PORT}`);
  });
})();