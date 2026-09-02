import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFilePath = path.join(__dirname, '../../gov_portal.sqlite');

let db = null;
const activeOtps = new Map();

export async function initDatabase() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
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

  db.run(`
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

  db.run(`
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

  // Seed default citizens if table is empty
  const res = db.exec('SELECT COUNT(*) as cnt FROM citizens');
  const count = res.length > 0 && res[0].values.length > 0 ? res[0].values[0][0] : 0;

  if (count === 0) {
    console.log('🌱 Seeding initial citizen records into SQLite database...');
    const seedCitizens = [
      ['Ramesh', 'Patil', '9876543210', 'ramesh.patil@gmail.com', '998877665544', 'RMPTL1234F'],
      ['Sunita', 'Deshmukh', '9812345678', 'sunita.deshmukh@yahoo.in', '887766554433', 'SNDSH5678K'],
      ['Priya', 'Sharma', '9900112233', 'priya.sharma@gmail.com', '123456789012', 'PRSHM9012L'],
      ['Ganesh', 'Kulkarni', '9765432109', 'ganesh.kulkarni@hotmail.com', '556677889900', 'GNKLK3456P'],
      ['Ananya', 'Joshi', '9654321098', 'ananya.joshi@outlook.com', '443322110099', 'ANJSH7890M']
    ];

    for (const c of seedCitizens) {
      db.run(
        `INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan) VALUES (?, ?, ?, ?, ?, ?)`,
        c
      );
    }

    // Seed some sample applications for status check
    const seedApps = [
      ['APP-MH-2026-101', 'Ramesh Dattatray Patil', 'Land Revenue & 7/12 Jamabandi Verification', '101', 'APPROVED', 'Land Revenue Department', '7/12 Jamabandi verified and mutation record clear.'],
      ['APP-MH-2026-102', 'Sunita Ashok Deshmukh', 'Inheritance Mutation Transfer & Property Card', '102', 'IN_PROGRESS', 'Sub-Registrar / Tahsildar Office', 'Notice period active (15 days objection window).'],
      ['APP-MH-2026-103', 'Priya Ramesh Sharma', 'Residential Building Permission NOC', '103', 'ACTION_REQUIRED', 'Town Planning & Municipal Corp', 'Bank mortgage encumbrance detected. NOC required from lender.'],
      ['APP-MH-2026-104', 'Ganesh Vishnu Kulkarni', 'Boundary Demarcation & Survey Measurement', '104', 'BLOCKED', 'District Settlement Commission', 'Civil court dispute pending under Case #PUN/2025/892.'],
      ['APP-MH-2026-105', 'Ananya Suresh Joshi', 'Agricultural Pump Power Meter Sanction', '105', 'APPROVED', 'MSEDCL / Mahavitaran', 'High-tension agricultural line feasibility confirmed.']
    ];

    for (const a of seedApps) {
      db.run(
        `INSERT INTO applications (app_id, citizen_name, service_type, survey_number, status, department, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        a
      );
    }

    saveDb();
    console.log('✅ SQLite Database seeded successfully.');
  }

  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbFilePath, buffer);
}

// Helper query functions
export function getCitizenByAadhaar(aadhaar) {
  const stmt = db.prepare('SELECT * FROM citizens WHERE aadhaar = :aadhaar');
  stmt.bind({ ':aadhaar': aadhaar });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function getCitizenByPan(pan) {
  const stmt = db.prepare('SELECT * FROM citizens WHERE pan = :pan');
  stmt.bind({ ':pan': pan });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function getCitizenByMobile(mobile) {
  const stmt = db.prepare('SELECT * FROM citizens WHERE mobile = :mobile');
  stmt.bind({ ':mobile': mobile });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function getCitizenByEmail(email) {
  const stmt = db.prepare('SELECT * FROM citizens WHERE email = :email');
  stmt.bind({ ':email': email });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function createCitizen({ firstName, lastName, mobile, email, aadhaar, pan }) {
  db.run(
    `INSERT INTO citizens (first_name, last_name, mobile, email, aadhaar, pan) VALUES (?, ?, ?, ?, ?, ?)`,
    [firstName, lastName, mobile, email, aadhaar, pan]
  );
  saveDb();
  return getCitizenByAadhaar(aadhaar);
}

export function getAllCitizens(limit = 10) {
  const res = db.exec(`SELECT id, first_name, last_name, mobile, email, aadhaar, pan FROM citizens LIMIT ${limit}`);
  if (res.length === 0) return [];
  const columns = res[0].columns;
  return res[0].values.map(vals => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = vals[idx];
    });
    return obj;
  });
}

export function getApplicationById(appId) {
  const stmt = db.prepare('SELECT * FROM applications WHERE app_id = :appId');
  stmt.bind({ ':appId': appId });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

export function createApplication({ appId, citizenName, serviceType, surveyNumber, status, department, remarks }) {
  db.run(
    `INSERT INTO applications (app_id, citizen_name, service_type, survey_number, status, department, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [appId, citizenName, serviceType, surveyNumber, status, department, remarks]
  );
  saveDb();
  return getApplicationById(appId);
}

export function createFeedback({ name, email, category, rating, message }) {
  db.run(
    `INSERT INTO feedback (name, email, category, rating, message) VALUES (?, ?, ?, ?, ?)`,
    [name, email, category, rating, message]
  );
  saveDb();
}

export { activeOtps };
