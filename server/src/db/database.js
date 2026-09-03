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
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASS = process.env.PG_PASSWORD || 'Ajinkya%401115';
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = process.env.PG_PORT || 5432;

export const poolInterop = new Pool({ connectionString: `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/interop_platform` });
export const poolLand = new Pool({ connectionString: `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/land_department` });
export const poolElec = new Pool({ connectionString: `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/electricity_department` });
export const poolPoll = new Pool({ connectionString: `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/pollution_department` });

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
      aadhaar TEXT NOT NULL UNIQUE,
      pan TEXT NOT NULL UNIQUE,
      aadhaar_verified INTEGER DEFAULT 1,
      pan_verified INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

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
        aadhaar VARCHAR(20) UNIQUE NOT NULL,
        pan VARCHAR(20) UNIQUE NOT NULL,
        aadhaar_verified BOOLEAN DEFAULT TRUE,
        pan_verified BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default enterprise and citizen records into PostgreSQL
    const defaultCitizens = [
      ['ABC', 'Industries', '9876543210', 'applicant@abcindustries.com', '998877665544', 'ABCDE1234F'],
      ['XYZ', 'Manufacturing', '9812345678', 'applicant@xyzmfg.com', '887766554433', 'FGHIJ5678K'],
      ['Ramesh', 'Patil', '9900112233', 'ramesh.patil@gmail.com', '123456789012', 'RMPTL1234F'],
      ['Sunita', 'Deshmukh', '9765432109', 'sunita.deshmukh@yahoo.in', '556677889900', 'SNDSH5678K'],
      ['Priya', 'Sharma', '9654321098', 'priya.sharma@gmail.com', '443322110099', 'PRSHM9012L']
    ];

    for (const c of defaultCitizens) {
      await client.query(`
        INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (pan) DO NOTHING;
      `, c);
    }

    client.release();
    console.log('🐘 PostgreSQL connected and synced (interop_platform, land_department, electricity_department, pollution_department).');
  } catch (err) {
    console.warn('⚠️ PostgreSQL connection failed, operating with SQLite storage:', err.message);
    isPgConnected = false;
  }

  // Seed default citizens in SQLite
  const res = sqliteDb.exec('SELECT COUNT(*) as cnt FROM citizens');
  const count = res.length > 0 && res[0].values.length > 0 ? res[0].values[0][0] : 0;
  if (count === 0) {
    const seedCitizens = [
      ['ABC', 'Industries', '9876543210', 'applicant@abcindustries.com', '998877665544', 'ABCDE1234F'],
      ['XYZ', 'Manufacturing', '9812345678', 'applicant@xyzmfg.com', '887766554433', 'FGHIJ5678K'],
      ['Ramesh', 'Patil', '9900112233', 'ramesh.patil@gmail.com', '123456789012', 'RMPTL1234F'],
      ['Sunita', 'Deshmukh', '9765432109', 'sunita.deshmukh@yahoo.in', '556677889900', 'SNDSH5678K'],
      ['Priya', 'Sharma', '9654321098', 'priya.sharma@gmail.com', '443322110099', 'PRSHM9012L']
    ];
    for (const c of seedCitizens) {
      sqliteDb.run(`INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan) VALUES (?, ?, ?, ?, ?, ?)`, c);
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
    } catch (_) {}
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
    } catch (_) {}
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
    } catch (_) {}
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
    } catch (_) {}
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
  const { firstName, lastName, mobile, email, aadhaar, pan } = citizenData;

  // Save to PostgreSQL
  if (isPgConnected) {
    try {
      const res = await poolInterop.query(`
        INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `, [firstName, lastName, mobile, email, aadhaar, pan]);

      // Also ensure users table has matching entry
      await poolInterop.query(`
        INSERT INTO users (email, hashed_password, organization_name, organization_pan, role)
        VALUES ($1, $2, $3, $4, 'APPLICANT')
        ON CONFLICT (email) DO NOTHING;
      `, [email, 'demo_hashed_pass', `${firstName} ${lastName}`, pan]).catch(() => null);

      if (res.rows.length > 0) {
        // Also save to SQLite
        try {
          sqliteDb.run(`INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan) VALUES (?, ?, ?, ?, ?, ?)`,
            [firstName, lastName, mobile, email, aadhaar, pan]);
          saveDb();
        } catch (_) {}
        return res.rows[0];
      }
    } catch (err) {
      console.warn('PostgreSQL insert error, falling back to SQLite:', err.message);
    }
  }

  // SQLite fallback
  sqliteDb.run(
    `INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan) VALUES (?, ?, ?, ?, ?, ?)`,
    [firstName, lastName, mobile, email, aadhaar, pan]
  );
  saveDb();
  return getCitizenByPan(pan);
}

export async function getAllCitizens(limit = 100) {
  if (isPgConnected) {
    try {
      const res = await poolInterop.query('SELECT * FROM citizens ORDER BY id DESC LIMIT $1', [limit]);
      return res.rows;
    } catch (_) {}
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

  // 4. Check SQLite fallback
  const stmt = sqliteDb.prepare('SELECT * FROM applications WHERE app_id = :id OR survey_number = :id');
  stmt.bind({ ':id': cleanId });
  if (stmt.step()) {
    const a = stmt.getAsObject();
    stmt.free();
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
  stmt.free();

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

export function createFeedback(fb) {
  sqliteDb.run(
    `INSERT INTO feedback (name, email, category, rating, message) VALUES (?, ?, ?, ?, ?)`,
    [fb.name, fb.email, fb.category, fb.rating, fb.message]
  );
  saveDb();
}
