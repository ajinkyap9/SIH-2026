// Where this service listens and where Samanvay's portal is.
//
// Local development: nothing to set — values come from the repo-root ports.json
// (the same file start-all.js uses), exactly as before.
// Cloud (e.g. Railway, one public URL per service): set these; they always win.
//   PORT, HOST              where this server listens (Railway sets PORT)
//   PORTAL_URL              the Samanvay portal's full URL
//   CORS_ALLOWED_ORIGINS    comma-separated origins, or * (default)
const fs = require('fs');
const path = require('path');

// Same values as ports.json; used only when ports.json is not available
// (a deploy that builds just this folder).
const DEFAULT_PORTS = {
  host: '127.0.0.1',
  services: {
    portal: { port: 5001 }, interop: { port: 8000 }, electricity: { port: 8001 },
    land: { port: 4000 }, pollution: { port: 4002 },
  },
};

function loadPorts() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../../ports.json'), 'utf8'));
  } catch (e) {
    return DEFAULT_PORTS;
  }
}

const PORTS = loadPorts();
const env = (name) => (process.env[name] || '').trim();
const stripSlash = (url) => url.replace(/\/+$/, '');

// A platform-assigned PORT means we are deployed: listen on all interfaces.
const PORT = Number(env('PORT')) || PORTS.services.land.port;
const HOST = env('HOST') || (env('PORT') ? '0.0.0.0' : PORTS.host);

// Portal URL for server-side calls (webhooks). Browser pages get PORTAL_URL only
// when it is explicitly set; otherwise they keep deriving it from their own hostname.
const PORTAL_URL = env('PORTAL_URL') ? stripSlash(env('PORTAL_URL')) : null;
const PORTAL_URL_FOR_SERVER = PORTAL_URL || `http://${PORTS.host}:${PORTS.services.portal.port}`;

const ORIGINS = (env('CORS_ALLOWED_ORIGINS') || '*').split(',').map((o) => stripSlash(o.trim())).filter(Boolean);

// Sets Access-Control-Allow-Origin: * by default, or echoes an allowed origin.
function allowOrigin(req, res) {
  if (ORIGINS.includes('*')) {
    res.header('Access-Control-Allow-Origin', '*');
    return;
  }
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(stripSlash(origin))) res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
}

module.exports = { PORTS, PORT, HOST, PORTAL_URL, PORTAL_URL_FOR_SERVER, allowOrigin };
