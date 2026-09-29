import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFilePath = path.join(__dirname, '../../gov_portal.sqlite');

let sqliteDb = null;
export const activeOtps = new Map();

// PostgreSQL Connection Pools
// Cloud: give each database its full connection string —
//   INTEROP_DATABASE_URL, LAND_DATABASE_URL, ELECTRICITY_DATABASE_URL, POLLUTION_DATABASE_URL.
// Local development: unset, so each is built from PG_USER / PG_PASSWORD / PG_HOST /
// PG_PORT and the database name, exactly as before.
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASS = process.env.PG_PASSWORD || 'Ajinkya%401115';
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = process.env.PG_PORT || 5432;
const pgUrl = (envName, dbName) =>
  process.env[envName] || `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${dbName}`;

export const poolInterop = new Pool({ connectionString: pgUrl('INTEROP_DATABASE_URL', 'interop_platform') });
export const poolLand = new Pool({ connectionString: pgUrl('LAND_DATABASE_URL', 'land_department') });
export const poolElec = new Pool({ connectionString: pgUrl('ELECTRICITY_DATABASE_URL', 'electricity_department') });
export const poolPoll = new Pool({ connectionString: pgUrl('POLLUTION_DATABASE_URL', 'pollution_department') });

// REQUIRE_POSTGRES=true (set in production): refuse to start rather than quietly
// fall back to the local SQLite file for citizen accounts.
const REQUIRE_POSTGRES = /^(1|true|yes)$/i.test(process.env.REQUIRE_POSTGRES || '');

// Timestamps are stored as text in the same 'YYYY-MM-DD HH:MM:SS' (UTC) form SQLite's
// CURRENT_TIMESTAMP produces, so API responses look the same whichever store served them.
const PG_NOW_TEXT = `to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`;

// A PostgreSQL call failed: with REQUIRE_POSTGRES the error propagates (never a
// silent SQLite write that a redeploy would erase); otherwise log and fall back.
function pgFailed(what, err) {
  if (REQUIRE_POSTGRES) throw err;
  console.warn(`⚠️ PostgreSQL ${what} failed, using SQLite:`, err.message || err.code || String(err));
}

// Portal-owned tables in PostgreSQL (interop_platform database).
async function ensurePortalTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      app_id TEXT NOT NULL UNIQUE,
      citizen_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      survey_number TEXT,
      status TEXT DEFAULT 'SUBMITTED',
      department TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT ${PG_NOW_TEXT},
      updated_at TEXT DEFAULT ${PG_NOW_TEXT}
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL,
      rating INTEGER,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT ${PG_NOW_TEXT}
    );
    CREATE TABLE IF NOT EXISTS dept_applications (
      id SERIAL PRIMARY KEY,
      ref_no TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      citizen_name TEXT NOT NULL,
      citizen_pan TEXT NOT NULL,
      project_name TEXT NOT NULL,
      project_type TEXT NOT NULL,
      district TEXT,
      ref_number TEXT,
      status TEXT DEFAULT 'PENDING',
      admin_remarks TEXT,
      submitted_at TEXT DEFAULT ${PG_NOW_TEXT},
      reviewed_at TEXT,
      reviewed_by TEXT
    );
    CREATE TABLE IF NOT EXISTS custom_departments (
      id SERIAL PRIMARY KEY,
      dept_code TEXT NOT NULL UNIQUE,
      dept_name TEXT NOT NULL,
      category TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      api_port INTEGER,
      service_name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT ${PG_NOW_TEXT}
    );
    CREATE TABLE IF NOT EXISTS schema_mappings (
      id SERIAL PRIMARY KEY,
      dept_code TEXT NOT NULL,
      dept_field TEXT NOT NULL,
      samanvay_field TEXT NOT NULL,
      transformation_rule TEXT NOT NULL,
      confidence INTEGER DEFAULT 95,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT ${PG_NOW_TEXT}
    );
  `);
}

// One-time move of rows from the local SQLite file into PostgreSQL: a table is
// copied only while its PostgreSQL copy is still empty, so this never duplicates
// or overwrites data. (On a fresh cloud container the SQLite file holds only the
// built-in default departments and mappings, which seeds them the first time.)
const PORTAL_TABLE_COLUMNS = {
  applications: ['app_id', 'citizen_name', 'service_type', 'survey_number', 'status', 'department', 'remarks', 'created_at', 'updated_at'],
  feedback: ['name', 'email', 'category', 'rating', 'message', 'created_at'],
  dept_applications: ['ref_no', 'department', 'citizen_name', 'citizen_pan', 'project_name', 'project_type', 'district', 'ref_number', 'status', 'admin_remarks', 'submitted_at', 'reviewed_at', 'reviewed_by'],
  custom_departments: ['dept_code', 'dept_name', 'category', 'endpoint_url', 'api_port', 'service_name', 'description', 'status', 'created_at'],
  schema_mappings: ['dept_code', 'dept_field', 'samanvay_field', 'transformation_rule', 'confidence', 'status', 'created_at'],
};

async function copySqliteTablesToPg(client) {
  for (const [table, cols] of Object.entries(PORTAL_TABLE_COLUMNS)) {
    const existing = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    if (existing.rows[0].n > 0) continue;
    const res = sqliteDb.exec(`SELECT ${cols.join(', ')} FROM ${table} ORDER BY id ASC`);
    const rows = res.length ? res[0].values : [];
    if (!rows.length) continue;
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    // All rows of a table or none: a half-copied table would look "done" (non-empty)
    // on the next start and the rest of its rows would never be moved.
    await client.query('BEGIN');
    try {
      for (const row of rows) {
        await client.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, row);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
    console.log(`🐘 Moved ${rows.length} ${table} row(s) from SQLite into PostgreSQL.`);
  }
}

let isPgConnected = false;

export async function initDatabase() {
  // 1. Initialize SQLite (for robust fallback & local state)
  const SQL = await initSqlJs();
  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    sqliteDb = new SQL.Database(fileBuffer);
  } else {
    sqliteDb = new SQL.Database();
  }

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS citizens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      aadhaar TEXT UNIQUE,
      pan TEXT NOT NULL UNIQUE,
      password TEXT DEFAULT 'pass123',
      account_type TEXT DEFAULT 'INDIVIDUAL',
      aadhaar_verified INTEGER DEFAULT 1,
      pan_verified INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try { sqliteDb.run(`ALTER TABLE citizens ADD COLUMN password TEXT DEFAULT 'pass123'`); } catch(e) {}
  try { sqliteDb.run(`ALTER TABLE citizens ADD COLUMN account_type TEXT DEFAULT 'INDIVIDUAL'`); } catch(e) {}

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL UNIQUE,
      citizen_name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      survey_number TEXT,
      status TEXT DEFAULT 'SUBMITTED',
      department TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL,
      rating INTEGER,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS dept_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_no TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      citizen_name TEXT NOT NULL,
      citizen_pan TEXT NOT NULL,
      project_name TEXT NOT NULL,
      project_type TEXT NOT NULL,
      district TEXT,
      ref_number TEXT,
      status TEXT DEFAULT 'PENDING',
      admin_remarks TEXT,
      submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      reviewed_by TEXT
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS custom_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_code TEXT NOT NULL UNIQUE,
      dept_name TEXT NOT NULL,
      category TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      api_port INTEGER,
      service_name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS schema_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dept_code TEXT NOT NULL,
      dept_field TEXT NOT NULL,
      samanvay_field TEXT NOT NULL,
      transformation_rule TEXT NOT NULL,
      confidence INTEGER DEFAULT 95,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default departments if custom_departments table is empty
  const deptCountRes = sqliteDb.exec('SELECT COUNT(*) FROM custom_departments');
  const dCount = deptCountRes.length > 0 && deptCountRes[0].values.length > 0 ? deptCountRes[0].values[0][0] : 0;
  if (dCount === 0) {
    // Display-only registry entries: the deployed URLs when configured, else the local ones.
    const defaults = [
      ['LAND', 'Land Revenue Department (महाभूलेख)', 'Land & Revenue', process.env.LAND_API_URL || 'http://localhost:4000', 4000, '7/12 Land Mutation & NA Clearance', 'Handles land 7/12 extract, ownership verification and NA clearance.'],
      ['ELECTRICITY', 'MSEDCL Electricity Department (महावितरण)', 'Utilities & Power', process.env.ELECTRICITY_API_URL || 'http://localhost:8001', 8001, 'Industrial Power Sanction & Load Clearance', 'Handles new industrial electricity connection and power load clearance.'],
      ['POLLUTION', 'State Pollution Control Board (MPCB)', 'Environment & Pollution', process.env.POLLUTION_API_URL || 'http://localhost:4002', 4002, 'Consent to Establish (CTE) Clearance', 'Handles environmental consent and industrial pollution category clearance.']
    ];
    for (const d of defaults) {
      sqliteDb.run(`INSERT INTO custom_departments (dept_code, dept_name, category, endpoint_url, api_port, service_name, description) VALUES (?, ?, ?, ?, ?, ?, ?)`, d);
    }

    const defaultMappings = [
      ['LAND', 'owner_pan', 'organization_pan', 'Exact text match', 98],
      ['LAND', 'gtn', 'survey_number', 'Exact text match', 96],
      ['LAND', 'jamabandi', 'clearance_status', 'Status translation', 95],
      ['ELECTRICITY', 'applicant_pan', 'organization_pan', 'Exact text match', 98],
      ['ELECTRICITY', 'sanctioned_load_kva', 'sanctioned_load_kw', 'Converted to a number', 96],
      ['ELECTRICITY', 'connection_status', 'clearance_status', 'Status translation', 95],
      ['POLLUTION', 'industry_pan', 'organization_pan', 'Exact text match', 98],
      ['POLLUTION', 'consent_validity', 'valid_until', 'Converted to a standard date', 95],
      ['POLLUTION', 'consent_type', 'clearance_type', 'Exact text match', 95]
    ];
    for (const m of defaultMappings) {
      sqliteDb.run(`INSERT INTO schema_mappings (dept_code, dept_field, samanvay_field, transformation_rule, confidence) VALUES (?, ?, ?, ?, ?)`, m);
    }
    saveDb();
  }

  // 2. Initialize PostgreSQL tables & connect
  try {
    const client = await poolInterop.connect();
    isPgConnected = true;

    // Create citizens table in interop_platform if missing
    await client.query(`
      CREATE TABLE IF NOT EXISTS citizens (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        mobile VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        aadhaar VARCHAR(50) UNIQUE,
        pan VARCHAR(20) UNIQUE NOT NULL,
        password VARCHAR(100) DEFAULT 'pass123',
        account_type VARCHAR(20) DEFAULT 'INDIVIDUAL',
        aadhaar_verified BOOLEAN DEFAULT TRUE,
        pan_verified BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default enterprise and citizen records into PostgreSQL
    const defaultCitizens = [
      ['ABC Industries', 'Pvt Ltd', '9876543210', 'applicant@abcindustries.com', '998877665544', 'ABCDE1234F', 'pass123', 'COMPANY'],
      ['XYZ Manufacturing', 'Ltd', '9812345678', 'applicant@xyzmfg.com', '887766554433', 'FGHIJ5678K', 'pass123', 'COMPANY'],
      ['Ramesh', 'Patil', '9900112233', 'ramesh.patil@gmail.com', '123456789012', 'RMPTL1234F', 'pass123', 'INDIVIDUAL'],
      ['Sunita', 'Deshmukh', '9765432109', 'sunita.deshmukh@yahoo.in', '556677889900', 'SNDSH5678K', 'pass123', 'INDIVIDUAL'],
      ['Priya', 'Sharma', '9654321098', 'priya.sharma@gmail.com', '443322110099', 'PRSHM9012L', 'pass123', 'INDIVIDUAL']
    ];

    for (const c of defaultCitizens) {
      await client.query(`
        INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan, password, account_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (pan) DO NOTHING;
      `, c);
    }

    // Portal-owned tables (applications, feedback, dept_applications,
    // custom_departments, schema_mappings) live in PostgreSQL too.
    await ensurePortalTables(client);
    await copySqliteTablesToPg(client);

    client.release();

    // REQUIRE_POSTGRES covers every database the portal reads, not just its own.
    if (REQUIRE_POSTGRES) {
      for (const [name, pool] of [['LAND_DATABASE_URL', poolLand], ['ELECTRICITY_DATABASE_URL', poolElec], ['POLLUTION_DATABASE_URL', poolPoll]]) {
        try { await pool.query('SELECT 1'); }
        catch (e) { throw new Error(`${name} is unreachable: ${e.message || e.code || String(e)}`); }
      }
    }
    console.log('🐘 PostgreSQL connected and synced (interop_platform, land_department, electricity_department, pollution_department).');
  } catch (err) {
    if (REQUIRE_POSTGRES) {
      throw new Error(`REQUIRE_POSTGRES is set but PostgreSQL is unavailable: ${err.message || err.code || String(err)}`);
    }
    console.warn('⚠️ PostgreSQL connection failed, operating with SQLite storage:', err.message);
    isPgConnected = false;
  }

  // Seed default citizens in SQLite
  const res = sqliteDb.exec('SELECT COUNT(*) as cnt FROM citizens');
  const count = res.length > 0 && res[0].values.length > 0 ? res[0].values[0][0] : 0;
  if (count === 0) {
    const seedCitizens = [
      ['ABC Industries', 'Pvt Ltd', '9876543210', 'applicant@abcindustries.com', '998877665544', 'ABCDE1234F', 'pass123', 'COMPANY'],
      ['XYZ Manufacturing', 'Ltd', '9812345678', 'applicant@xyzmfg.com', '887766554433', 'FGHIJ5678K', 'pass123', 'COMPANY'],
      ['Ramesh', 'Patil', '9900112233', 'ramesh.patil@gmail.com', '123456789012', 'RMPTL1234F', 'pass123', 'INDIVIDUAL'],
      ['Sunita', 'Deshmukh', '9765432109', 'sunita.deshmukh@yahoo.in', '556677889900', 'SNDSH5678K', 'pass123', 'INDIVIDUAL'],
      ['Priya', 'Sharma', '9654321098', 'priya.sharma@gmail.com', '443322110099', 'PRSHM9012L', 'pass123', 'INDIVIDUAL']
    ];
    for (const c of seedCitizens) {
      sqliteDb.run(`INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan, password, account_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, c);
    }
    saveDb();
  }

  return sqliteDb;
}

export function saveDb() {
  if (!sqliteDb) return;
  try {
    const data = sqliteDb.export();
    fs.writeFileSync(dbFilePath, Buffer.from(data));
  } catch (_) {}
}

// ============================================================================
// CITIZEN & USER DATA ACCESS (PostgreSQL Primary -> SQLite Fallback)
// ============================================================================

export async function getCitizenByAadhaar(aadhaar) {
  const clean = String(aadhaar).replace(/[\s-]/g, '');

  if (isPgConnected) {
    try {
      const res = await poolInterop.query('SELECT * FROM citizens WHERE aadhaar = $1', [clean]);
      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          mobile: r.mobile,
          email: r.email,
          aadhaar: r.aadhaar,
          pan: r.pan
        };
      }
    } catch (err) { pgFailed('citizen lookup', err); }
    if (REQUIRE_POSTGRES) return null;   // PostgreSQL answered: not found
  }

  // Fallback to SQLite
  const stmt = sqliteDb.prepare('SELECT * FROM citizens WHERE aadhaar = :aadhaar');
  stmt.bind({ ':aadhaar': clean });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export async function getCitizenByPan(pan) {
  const clean = String(pan).replace(/\s/g, '').toUpperCase();

  if (isPgConnected) {
    try {
      // 1. Check citizens table
      const res = await poolInterop.query('SELECT * FROM citizens WHERE UPPER(pan) = $1', [clean]);
      if (res.rows.length > 0) {
        const r = res.rows[0];
        return {
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          mobile: r.mobile,
          email: r.email,
          aadhaar: r.aadhaar,
          pan: r.pan
        };
      }

      // 2. Check users table (from interop_platform.sql)
      const uRes = await poolInterop.query('SELECT * FROM users WHERE UPPER(organization_pan) = $1', [clean]);
      if (uRes.rows.length > 0) {
        const u = uRes.rows[0];
        const parts = (u.organization_name || 'Enterprise Applicant').split(' ');
        return {
          id: u.id,
          first_name: parts[0] || 'Enterprise',
          last_name: parts.slice(1).join(' ') || 'User',
          mobile: '9876543210',
          email: u.email,
          aadhaar: '998877665544',
          pan: u.organization_pan
        };
      }
    } catch (err) { pgFailed('citizen lookup', err); }
    if (REQUIRE_POSTGRES) return null;   // PostgreSQL answered: not found
  }

  // Fallback to SQLite
  const stmt = sqliteDb.prepare('SELECT * FROM citizens WHERE UPPER(pan) = :pan');
  stmt.bind({ ':pan': clean });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export async function getCitizenByMobile(mobile) {
  const clean = String(mobile).replace(/[\s-]/g, '');
  if (isPgConnected) {
    try {
      const res = await poolInterop.query('SELECT * FROM citizens WHERE mobile = $1', [clean]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) { pgFailed('citizen lookup', err); }
    if (REQUIRE_POSTGRES) return null;   // PostgreSQL answered: not found
  }
  const stmt = sqliteDb.prepare('SELECT * FROM citizens WHERE mobile = :mobile');
  stmt.bind({ ':mobile': clean });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export async function getCitizenByEmail(email) {
  const clean = String(email).trim().toLowerCase();
  if (isPgConnected) {
    try {
      const res = await poolInterop.query('SELECT * FROM citizens WHERE LOWER(email) = $1', [clean]);
      if (res.rows.length > 0) return res.rows[0];
      const uRes = await poolInterop.query('SELECT * FROM users WHERE LOWER(email) = $1', [clean]);
      if (uRes.rows.length > 0) {
        const u = uRes.rows[0];
        return {
          id: u.id,
          first_name: u.organization_name,
          last_name: 'Pvt Ltd',
          mobile: '9876543210',
          email: u.email,
          aadhaar: '998877665544',
          pan: u.organization_pan
        };
      }
    } catch (err) { pgFailed('citizen lookup', err); }
    if (REQUIRE_POSTGRES) return null;   // PostgreSQL answered: not found
  }
  const stmt = sqliteDb.prepare('SELECT * FROM citizens WHERE LOWER(email) = :email');
  stmt.bind({ ':email': clean });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export async function createCitizen(citizenData) {
  const { firstName, lastName, mobile, email, aadhaar, pan, password, accountType } = citizenData;
  const pass = password || 'pass123';
  const type = (accountType || 'INDIVIDUAL').toUpperCase();
  const fName = firstName || (type === 'COMPANY' ? lastName : 'Individual');
  const lName = lastName || '';
  const aadh = aadhaar || (type === 'COMPANY' ? `COMP-${Date.now().toString().slice(-8)}` : '');

  // Save to PostgreSQL
  if (isPgConnected) {
    try {
      const res = await poolInterop.query(`
        INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan, password, account_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `, [fName, lName, mobile, email, aadh, pan, pass, type]);

      await poolInterop.query(`
        INSERT INTO users (email, hashed_password, organization_name, organization_pan, role)
        VALUES ($1, $2, $3, $4, 'APPLICANT')
        ON CONFLICT (email) DO NOTHING;
      `, [email, pass, `${fName} ${lName}`.trim(), pan]).catch(() => null);

      if (res.rows.length > 0) {
        try {
          sqliteDb.run(`INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan, password, account_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [fName, lName, mobile, email, aadh, pan, pass, type]);
          saveDb();
        } catch (_) {}
        return res.rows[0];
      }
    } catch (err) {
      pgFailed('citizen insert', err);
    }
  }

  // SQLite fallback
  sqliteDb.run(
    `INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan, password, account_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [fName, lName, mobile, email, aadh, pan, pass, type]
  );
  saveDb();
  return getCitizenByPan(pan);
}

export async function getAllCitizens(limit = 100) {
  if (isPgConnected) {
    try {
      const res = await poolInterop.query('SELECT * FROM citizens ORDER BY id DESC LIMIT $1', [limit]);
      return res.rows;
    } catch (err) { pgFailed('citizen lookup', err); }
    if (REQUIRE_POSTGRES) return null;   // PostgreSQL answered: not found
  }
  const stmt = sqliteDb.prepare('SELECT * FROM citizens ORDER BY id DESC LIMIT :limit');
  stmt.bind({ ':limit': limit });
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// ============================================================================
// APPLICATION TRACKING & MULTI-DEPARTMENT DATABASE RESOLUTION
// ============================================================================

export async function getApplicationDetails(appId) {
  const cleanId = String(appId).trim();

  // 1. Electricity Applications (if ELEC ID)
  if (cleanId.startsWith('ELEC-')) {
    try {
      const elecRes = await poolElec.query('SELECT * FROM electricity_applications WHERE application_number = $1 OR applicant_pan = $1', [cleanId]);
      if (elecRes.rows.length > 0) {
        const el = elecRes.rows[0];
        return {
          found: true,
          appId: el.application_number,
          title: `${el.applicant_name} — Power Supply Sanction`,
          citizenName: el.applicant_name,
          serviceType: `MSEDCL Grid Feeder Sanction (${el.sanctioned_load || el.requested_load} ${el.sanctioned_load_unit || 'KW'})`,
          surveyNumber: 'ELEC-FEEDER',
          status: el.application_status,
          badgeClass: el.application_status === 'APPROVED' ? 'status-tag status-approved' : 'status-tag status-pending',
          department: 'Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL)',
          currentStage: `Power Sanction: ${el.application_status} (Meter: ${el.meter_status}, Feeder: ${el.connection_status})`,
          step: el.application_status === 'APPROVED' ? 4 : 3,
          remarks: `Sanctioned Load: ${el.sanctioned_load} KW. Deposit: ${el.security_deposit_status}.`,
          nextAction: el.application_status === 'APPROVED' ? 'Dedicated feeder line active and ready for operations.' : 'Awaiting Chief Engineer field load sanction.',
          updatedAt: el.last_updated || new Date().toISOString()
        };
      }
    } catch (_) {}
  }

  // 2. Pollution Applications (if MPCB ID)
  if (cleanId.startsWith('MPCB-')) {
    try {
      const pollRes = await poolPoll.query('SELECT * FROM pollution_applications WHERE application_no = $1 OR industry_pan = $1', [cleanId]);
      if (pollRes.rows.length > 0) {
        const pol = pollRes.rows[0];
        return {
          found: true,
          appId: pol.application_no,
          title: `${pol.industry_name} — MPCB Environmental Consent`,
          citizenName: pol.industry_name,
          serviceType: `Consent to Establish (CTE) — ${pol.air_emission_category} Category`,
          surveyNumber: pol.application_project_id || 'PROJ',
          status: pol.consent_status,
          badgeClass: pol.consent_status === 'APPROVED' ? 'status-tag status-approved' : 'status-tag status-pending',
          department: `Maharashtra Pollution Control Board (${pol.region})`,
          currentStage: `Environmental Clearance: ${pol.consent_status} (Compliance: ${pol.compliance_status})`,
          step: pol.consent_status === 'APPROVED' ? 4 : 3,
          remarks: `Emission Category: ${pol.air_emission_category}, Water Discharge: ${pol.water_discharge_category}, HazWaste: ${pol.hazardous_waste ? 'Yes' : 'No'}.`,
          nextAction: pol.consent_status === 'APPROVED' ? 'CTE Consent order issued. Valid until ' + (pol.valid_until ? pol.valid_until.toISOString().split('T')[0] : '2027') : 'Under environmental appraisal committee review.',
          updatedAt: new Date().toISOString()
        };
      }
    } catch (_) {}
  }

  // 3. Check Land Records in PostgreSQL (by survey number like 101, 102, 103 or APP-MH-2026-101)
  const surveyMatch = cleanId.match(/\d+/);
  const surveyNumber = surveyMatch ? surveyMatch[0] : cleanId;

  try {
    const landRes = await poolLand.query('SELECT * FROM land_records WHERE gtn = $1', [surveyNumber]);
    if (landRes.rows.length > 0) {
      const land = landRes.rows[0];
      const isApproved = land.jamabandi === 'APPROVED';
      const isPending = land.jamabandi === 'PENDING';
      return {
        found: true,
        appId: `APP-MH-2026-${land.gtn}`,
        title: `${land.malak_name} — Industrial Land Clearance (Survey #${land.gtn})`,
        citizenName: land.malak_name,
        serviceType: `7/12 Land Mutation & Title Deed (${land.jamin_prakar})`,
        surveyNumber: land.gtn,
        status: land.jamabandi,
        badgeClass: isApproved ? 'status-tag status-approved' : isPending ? 'status-tag status-waiting' : 'status-tag status-pending',
        department: `Revenue & Land Settlement Department (${land.district})`,
        currentStage: isApproved ? '7/12 Jamabandi Approved & Mutation Verified' : 'Mutation Under Tahsildar Review',
        step: isApproved ? 4 : isPending ? 2 : 3,
        remarks: land.bandhak ? '⚠️ Bank encumbrance active.' : (land.court_case ? '⚠️ Court litigation active.' : '✓ Title deed clear and unencumbered in PostgreSQL.'),
        nextAction: isApproved ? 'Land gate verified. Proceed to MSEDCL Electricity & MPCB Pollution portals.' : 'Awaiting Tahsildar mutation sanction.',
        updatedAt: new Date().toISOString()
      };
    }
  } catch (_) {}

  // 4. Portal's own applications table (PostgreSQL, else SQLite)
  let a = null;
  let pgDone = false;
  if (isPgConnected) {
    try {
      const r = await poolInterop.query('SELECT * FROM applications WHERE app_id = $1 OR survey_number = $1 LIMIT 1', [cleanId]);
      a = r.rows[0] || null;
      pgDone = true;
    } catch (err) { pgFailed('applications read', err); }
  }
  if (!pgDone) {
    const stmt = sqliteDb.prepare('SELECT * FROM applications WHERE app_id = :id OR survey_number = :id');
    stmt.bind({ ':id': cleanId });
    if (stmt.step()) a = stmt.getAsObject();
    stmt.free();
  }
  if (a) {
    return {
      found: true,
      appId: a.app_id,
      title: `${a.citizen_name} — ${a.service_type}`,
      citizenName: a.citizen_name,
      serviceType: a.service_type,
      surveyNumber: a.survey_number,
      status: a.status,
      badgeClass: a.status === 'APPROVED' ? 'status-tag status-approved' : 'status-tag status-pending',
      department: a.department || 'Government Department',
      currentStage: `Stage: ${a.status}`,
      step: a.status === 'APPROVED' ? 4 : 3,
      remarks: a.remarks || 'Application under departmental scrutiny.',
      nextAction: 'Reviewing statutory prerequisites.',
      updatedAt: a.updated_at
    };
  }

  return null;
}

export async function getAllProjectApplications() {
  const list = [];

  // Land Records
  try {
    const landRes = await poolLand.query('SELECT * FROM land_records ORDER BY gtn ASC');
    landRes.rows.forEach(r => {
      list.push({
        id: `APP-MH-2026-${r.gtn}`,
        label: `${r.malak_name} — Land Survey #${r.gtn} (${r.jamabandi})`,
        department: 'Land Revenue & 7/12 Jamabandi',
        status: r.jamabandi,
        survey: r.gtn
      });
    });
  } catch (_) {}

  // Electricity Applications
  try {
    const elecRes = await poolElec.query('SELECT * FROM electricity_applications ORDER BY application_number ASC');
    elecRes.rows.forEach(r => {
      list.push({
        id: r.application_number,
        label: `${r.applicant_name} — Power Feeder ${r.application_number} (${r.application_status})`,
        department: 'MSEDCL Electricity Discom',
        status: r.application_status,
        survey: 'ELEC'
      });
    });
  } catch (_) {}

  // Pollution Applications
  try {
    const pollRes = await poolPoll.query('SELECT * FROM pollution_applications ORDER BY application_no ASC');
    pollRes.rows.forEach(r => {
      list.push({
        id: r.application_no,
        label: `${r.industry_name} — MPCB Consent ${r.application_no} (${r.consent_status})`,
        department: 'MPCB Pollution Board',
        status: r.consent_status,
        survey: 'MPCB'
      });
    });
  } catch (_) {}

  if (list.length === 0) {
    list.push(
      { id: 'APP-MH-2026-101', label: 'ABC Industries – Manufacturing Plant (Ref: APP-MH-2026-101)', department: 'Land Revenue & MSEDCL', status: 'APPROVED' },
      { id: 'APP-MH-2026-102', label: 'XYZ Logistics – Warehouse & Cold Storage (Ref: APP-MH-2026-102)', department: 'Revenue & Town Planning', status: 'IN_PROGRESS' },
      { id: 'APP-MH-2026-103', label: 'Alpha Green Pharma – API Facility (Ref: APP-MH-2026-103)', department: 'MPCB & MSEDCL', status: 'APPROVED' }
    );
  }

  return list;
}

export async function createFeedback(fb) {
  if (isPgConnected) {
    try {
      await poolInterop.query(
        `INSERT INTO feedback (name, email, category, rating, message) VALUES ($1, $2, $3, $4, $5)`,
        [fb.name, fb.email, fb.category, fb.rating, fb.message]
      );
      return;
    } catch (err) { pgFailed('feedback insert', err); }
  }
  sqliteDb.run(
    `INSERT INTO feedback (name, email, category, rating, message) VALUES (?, ?, ?, ?, ?)`,
    [fb.name, fb.email, fb.category, fb.rating, fb.message]
  );
  saveDb();
}

// ============================================================================
// DEPARTMENT APPLICATION ADMIN WORKFLOW (PostgreSQL Primary -> SQLite Fallback)
// ============================================================================

export async function submitDeptApplication(data) {
  const { department, citizenName, citizenPan, projectName, projectType, district, refNumber } = data;
  const deptUpper = department.toUpperCase();
  const refNo = `REF-${deptUpper.slice(0, 3)}-${Date.now()}`;
  const panUpper = citizenPan.toUpperCase();

  const initialStatus = 'PENDING';
  const initialRemarks = 'Application submitted — awaiting admin review.';
  const values = [refNo, deptUpper, citizenName, panUpper, projectName, projectType, district || '', refNumber || '', initialStatus, initialRemarks];

  if (isPgConnected) {
    try {
      await poolInterop.query(
        `INSERT INTO dept_applications (ref_no, department, citizen_name, citizen_pan, project_name, project_type, district, ref_number, status, admin_remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        values
      );
      return { refNo, status: initialStatus };
    } catch (err) { pgFailed('dept_applications insert', err); }
  }

  sqliteDb.run(
    `INSERT INTO dept_applications (ref_no, department, citizen_name, citizen_pan, project_name, project_type, district, ref_number, status, admin_remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  saveDb();
  return { refNo, status: initialStatus };
}

export async function getDeptApplicationsByPan(pan) {
  if (isPgConnected) {
    try {
      const res = await poolInterop.query(
        `SELECT * FROM dept_applications WHERE UPPER(citizen_pan) = UPPER($1) ORDER BY submitted_at DESC, id DESC`, [pan]
      );
      return res.rows;
    } catch (err) { pgFailed('dept_applications read', err); }
  }
  const stmt = sqliteDb.prepare(
    `SELECT * FROM dept_applications WHERE UPPER(citizen_pan) = UPPER(?) ORDER BY submitted_at DESC`
  );
  stmt.bind([pan]);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export async function getAllDeptApplications(department) {
  if (isPgConnected) {
    try {
      const res = department
        ? await poolInterop.query(`SELECT * FROM dept_applications WHERE UPPER(department) = UPPER($1) ORDER BY submitted_at DESC, id DESC`, [department])
        : await poolInterop.query(`SELECT * FROM dept_applications ORDER BY submitted_at DESC, id DESC`);
      return res.rows;
    } catch (err) { pgFailed('dept_applications read', err); }
  }
  let sql = `SELECT * FROM dept_applications`;
  const binds = [];
  if (department) {
    sql += ` WHERE UPPER(department) = UPPER(?)`;
    binds.push(department);
  }
  sql += ` ORDER BY submitted_at DESC`;
  const stmt = sqliteDb.prepare(sql);
  if (binds.length) stmt.bind(binds);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export async function updateDeptApplicationStatus(refNo, status, adminRemarks, reviewedBy) {
  const newStatus = status.toUpperCase();

  if (isPgConnected) {
    try {
      const res = await poolInterop.query(
        `UPDATE dept_applications SET status = $1, admin_remarks = $2, reviewed_at = ${PG_NOW_TEXT}, reviewed_by = $3
         WHERE ref_no = $4 RETURNING *`,
        [newStatus, adminRemarks || '', reviewedBy || 'Admin', refNo]
      );
      if (res.rows.length === 0) return { error: `No application found with ref_no: ${refNo}` };
      return res.rows[0];
    } catch (err) { pgFailed('dept_applications update', err); }
  }

  // Fetch target application first
  const stmtTarget = sqliteDb.prepare(`SELECT * FROM dept_applications WHERE ref_no = ?`);
  stmtTarget.bind([refNo]);
  if (!stmtTarget.step()) {
    stmtTarget.free();
    return { error: `No application found with ref_no: ${refNo}` };
  }
  stmtTarget.free();

  // Update target application
  sqliteDb.run(
    `UPDATE dept_applications SET status = ?, admin_remarks = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ? WHERE ref_no = ?`,
    [newStatus, adminRemarks || '', reviewedBy || 'Admin', refNo]
  );

  saveDb();

  const stmtResult = sqliteDb.prepare(`SELECT * FROM dept_applications WHERE ref_no = ?`);
  stmtResult.bind([refNo]);
  let updatedRow = null;
  if (stmtResult.step()) updatedRow = stmtResult.getAsObject();
  stmtResult.free();
  return updatedRow;
}

export function autoMapDepartmentSchema(samplePayload, deptCode) {
  const code = (deptCode || 'NEW_DEPT').toUpperCase();
  let keys = [];

  if (typeof samplePayload === 'string') {
    try {
      const parsed = JSON.parse(samplePayload);
      keys = Object.keys(parsed);
    } catch (e) {
      keys = samplePayload.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    }
  } else if (typeof samplePayload === 'object' && samplePayload !== null) {
    keys = Object.keys(samplePayload);
  }

  const suggestions = [];
  const processedKeys = new Set();

  for (const key of keys) {
    const k = key.toLowerCase();
    let samanvayField = 'additional_metadata';
    let rule = 'Exact text match';
    let confidence = 90;

    if (k.includes('pan') || k.includes('tax_id') || k.includes('gstin') || k.includes('registration_no')) {
      samanvayField = 'organization_pan';
      rule = 'Exact text match';
      confidence = 98;
    } else if (k.includes('name') || k.includes('applicant') || k.includes('company') || k.includes('owner') || k.includes('firm')) {
      samanvayField = 'applicant_name';
      rule = 'Exact text match';
      confidence = 95;
    } else if (k.includes('status') || k.includes('state') || k.includes('approval') || k.includes('clearance') || k.includes('sanction')) {
      samanvayField = 'clearance_status';
      rule = 'Status translation';
      confidence = 96;
    } else if (k.includes('date') || k.includes('valid') || k.includes('expiry') || k.includes('until') || k.includes('issue')) {
      samanvayField = 'valid_until';
      rule = 'Converted to a standard date';
      confidence = 94;
    } else if (k.includes('load') || k.includes('capacity') || k.includes('area') || k.includes('quota') || k.includes('kw') || k.includes('kl') || k.includes('volume')) {
      samanvayField = 'sanctioned_capacity';
      rule = 'Converted to a number';
      confidence = 92;
    } else if (k.includes('survey') || k.includes('gat') || k.includes('plot') || k.includes('survey_no') || k.includes('land')) {
      samanvayField = 'survey_number';
      rule = 'Exact text match';
      confidence = 96;
    } else if (k.includes('district') || k.includes('city') || k.includes('location') || k.includes('taluka') || k.includes('village')) {
      samanvayField = 'location_district';
      rule = 'Exact text match';
      confidence = 95;
    }

    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      suggestions.push({
        dept_code: code,
        dept_field: key,
        samanvay_field: samanvayField,
        transformation_rule: rule,
        confidence: confidence
      });
    }
  }

  return suggestions;
}

export async function getAllDepartments() {
  if (isPgConnected) {
    try {
      return (await poolInterop.query(`SELECT * FROM custom_departments ORDER BY id ASC`)).rows;
    } catch (err) { pgFailed('custom_departments read', err); }
  }
  const stmt = sqliteDb.prepare(`SELECT * FROM custom_departments ORDER BY id ASC`);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

export async function registerNewDepartment({ deptCode, deptName, category, endpointUrl, apiPort, serviceName, description, mappings }) {
  const code = (deptCode || '').trim().toUpperCase();
  if (!code || !deptName || !endpointUrl) {
    throw new Error('deptCode, deptName and endpointUrl are required.');
  }
  const deptValues = [code, deptName.trim(), category || 'General', endpointUrl.trim(), parseInt(apiPort) || 8000, serviceName || 'Clearance Service', description || ''];
  const hasMappings = Array.isArray(mappings) && mappings.length > 0;

  if (isPgConnected) {
    let client;
    try {
      client = await poolInterop.connect();
      await client.query('BEGIN');   // department + its mappings are saved together or not at all
      await client.query(
        `INSERT INTO custom_departments (dept_code, dept_name, category, endpoint_url, api_port, service_name, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (dept_code) DO UPDATE SET
         dept_name = EXCLUDED.dept_name, category = EXCLUDED.category, endpoint_url = EXCLUDED.endpoint_url,
         api_port = EXCLUDED.api_port, service_name = EXCLUDED.service_name, description = EXCLUDED.description`,
        deptValues
      );
      if (hasMappings) {
        await client.query(`DELETE FROM schema_mappings WHERE UPPER(dept_code) = $1`, [code]);
        for (const m of mappings) {
          await client.query(
            `INSERT INTO schema_mappings (dept_code, dept_field, samanvay_field, transformation_rule, confidence) VALUES ($1, $2, $3, $4, $5)`,
            [code, m.dept_field, m.samanvay_field, m.transformation_rule || 'Exact text match', m.confidence || 95]
          );
        }
      }
      await client.query('COMMIT');
      return { success: true, deptCode: code };
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      pgFailed('department registration', err);
    } finally {
      if (client) client.release();
    }
  }

  sqliteDb.run(
    `INSERT INTO custom_departments (dept_code, dept_name, category, endpoint_url, api_port, service_name, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(dept_code) DO UPDATE SET
     dept_name=excluded.dept_name, category=excluded.category, endpoint_url=excluded.endpoint_url, api_port=excluded.api_port, service_name=excluded.service_name, description=excluded.description`,
    deptValues
  );

  if (hasMappings) {
    sqliteDb.run(`DELETE FROM schema_mappings WHERE UPPER(dept_code) = ?`, [code]);
    for (const m of mappings) {
      sqliteDb.run(
        `INSERT INTO schema_mappings (dept_code, dept_field, samanvay_field, transformation_rule, confidence) VALUES (?, ?, ?, ?, ?)`,
        [code, m.dept_field, m.samanvay_field, m.transformation_rule || 'Exact text match', m.confidence || 95]
      );
    }
  }

  saveDb();
  return { success: true, deptCode: code };
}

export async function getAllSchemaMappings() {
  if (isPgConnected) {
    try {
      return (await poolInterop.query(`SELECT * FROM schema_mappings ORDER BY id ASC`)).rows;
    } catch (err) { pgFailed('schema_mappings read', err); }
  }
  const stmt = sqliteDb.prepare(`SELECT * FROM schema_mappings ORDER BY id ASC`);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}
