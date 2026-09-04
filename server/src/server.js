import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database.js';
import authRoutes from './routes/authRoutes.js';
import landRoutes from './routes/landRoutes.js';
import interopRoutes from './routes/interopRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import interviewProxy from './routes/interviewProxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
app.use('/api/interview', interviewProxy);

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
  function listenOnPort(port) {
    const server = app.listen(port, () => {
      console.log(`=======================================================`);
      console.log(`🏛️  MAITRI Government Interoperability Platform Running!`);
      console.log(`📡 URL: http://localhost:${port}`);
      console.log(`💾 SQLite Database initialized and ready.`);
      console.log(`=======================================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️  Port ${port} is currently in use (e.g., macOS AirPlay Receiver on port 5000).`);
        const nextPort = Number(port) + 1;
        console.log(`🔄 Automatically retrying on port ${nextPort}...`);
        listenOnPort(nextPort);
      } else {
        console.error('Server error:', err);
      }
    });
  }

  listenOnPort(Number(PORT));
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
