// Where this portal listens and where the other Samanvay services live.
//
// Local development: nothing to set. Addresses come from the repo-root
// ports.json (the same values start-all.js uses), exactly as before.
// Cloud (e.g. Railway, one public URL per service): set the environment
// variables below to each service's full URL; they always win.
//
//   PORT, HOST              where this server listens (Railway sets PORT)
//   INTEROP_BACKEND_URL     approvals service (interop_backend)
//   LAND_API_URL            Land Records service
//   ELECTRICITY_API_URL     Electricity (MSEDCL) service
//   POLLUTION_API_URL       Pollution (MPCB) service
//   CORS_ALLOWED_ORIGINS    comma-separated origins, or * (default)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  } catch {
    return DEFAULT_PORTS;
  }
}

export const PORTS = loadPorts();

const env = (name) => (process.env[name] || '').trim();
const stripSlash = (url) => url.replace(/\/+$/, '');
const localUrl = (name) => `http://${PORTS.host}:${PORTS.services[name].port}`;

// A platform-assigned PORT means we are deployed: listen on all interfaces.
export const PORT = Number(env('PORT')) || PORTS.services.portal.port;
export const HOST = env('HOST') || (env('PORT') ? '0.0.0.0' : PORTS.host);

export const INTEROP_BACKEND_URL = stripSlash(env('INTEROP_BACKEND_URL') || localUrl('interop'));
export const LAND_API_URL = stripSlash(env('LAND_API_URL') || localUrl('land'));
export const ELECTRICITY_API_URL = stripSlash(env('ELECTRICITY_API_URL') || localUrl('electricity'));
export const POLLUTION_API_URL = stripSlash(env('POLLUTION_API_URL') || localUrl('pollution'));

// Browser-facing department websites. Unset locally, so the pages keep their
// current built-in addresses; set in the cloud by the variables above.
export const PUBLIC_DEPARTMENT_URLS = {
  landUrl: env('LAND_API_URL') ? LAND_API_URL : null,
  electricityUrl: env('ELECTRICITY_API_URL') ? ELECTRICITY_API_URL : null,
  pollutionUrl: env('POLLUTION_API_URL') ? POLLUTION_API_URL : null,
};

const origins = env('CORS_ALLOWED_ORIGINS');
export const CORS_ORIGIN = !origins || origins === '*'
  ? '*'
  : origins.split(',').map((o) => stripSlash(o.trim())).filter(Boolean);
