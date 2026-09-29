import http from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database.js';
import { HOST, PORT, INTEROP_BACKEND_URL, PUBLIC_DEPARTMENT_URLS, CORS_ORIGIN } from './serviceUrls.js';
import authRoutes from './routes/authRoutes.js';
import landRoutes from './routes/landRoutes.js';
import interopRoutes from './routes/interopRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Listen address and other services' URLs: environment variables first, else
// the repo-root ports.json (local development). See serviceUrls.js.

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 Socket.io client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`❌ Socket.io client disconnected: ${socket.id}`);
  });
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Runtime config for the browser (loaded before the pages' own scripts), so no
// page hard-codes another service's address. Department URLs are null locally,
// where the pages keep their built-in addresses.
app.get('/config.js', (req, res) => {
  const config = { interopBackendUrl: INTEROP_BACKEND_URL, ...PUBLIC_DEPARTMENT_URLS };
  res.type('application/javascript').set('Cache-Control', 'no-store');
  res.send(`window.SAMANVAY_CONFIG = ${JSON.stringify(config)};\n`);
});

// Serve static frontend files directly
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/land', landRoutes);
app.use('/api/interop', interopRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Government Interoperability Platform Core',
    database: 'SQLite (Persistent)',
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start listening
initDatabase().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`🏛️  MAITRI Government Interoperability Platform Running!`);
    console.log(`📡 URL: http://${HOST}:${PORT}`);
    console.log(`⚡ Real-time Socket.io server active.`);
    console.log(`💾 SQLite Database initialized and ready.`);
    console.log(`=======================================================`);
  });

  // Fail loudly instead of drifting to another port.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} on ${HOST} is already in use. The portal must run on this port (ports.json, or PORT) — stop the other process and try again.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
