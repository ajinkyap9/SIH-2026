const { Pool } = require('pg');
const seedRecords = require('./landRecords.json');

/**
 * PostgreSQL-backed store with automatic JSON fallback.
 * Loads records directly from the 'land_department' database on startup.
 */
const records = new Map(seedRecords.map((r) => [r.gtn, { ...r }]));

const VALID_MUTATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'UNDER_OBJECTION'];

const pgConnectionString = process.env.DATABASE_URL || 'postgresql://postgres:Ajinkya%401115@localhost:5432/land_department';
let pool = null;

try {
  pool = new Pool({ connectionString: pgConnectionString });
  pool.query('SELECT * FROM land_records', (err, res) => {
    if (!err && res && res.rows) {
      res.rows.forEach((r) => {
        records.set(String(r.gtn), {
          gtn: String(r.gtn),
          malak_name: r.malak_name,
          malak_pan: r.malak_pan,
          kshetra: String(r.kshetra),
          kshetra_unit: r.kshetra_unit,
          jamabandi: r.jamabandi,
          jamin_prakar: r.jamin_prakar,
          bandhak: Boolean(r.bandhak),
          court_case: Boolean(r.court_case),
          district: r.district,
          taluka: r.taluka,
          village: r.village,
          simulateOutage: Boolean(r.simulate_outage)
        });
      });
      console.log(`[Land API] Connected to PostgreSQL (land_department) — ${res.rows.length} records loaded.`);
    } else if (err) {
      console.warn('[Land API] PostgreSQL query error, using local fallback:', err.message);
    }
  });
} catch (e) {
  console.warn('[Land API] PostgreSQL connection error, using local fallback:', e.message);
}

async function getRecord(surveyOrPan) {
  const query = String(surveyOrPan).trim();
  if (pool) {
    try {
      const res = await pool.query(
        'SELECT * FROM land_records WHERE gtn = $1 OR UPPER(malak_pan) = UPPER($1) LIMIT 1',
        [query]
      );
      if (res.rows && res.rows.length > 0) {
        const r = res.rows[0];
        const rec = {
          gtn: String(r.gtn),
          malak_name: r.malak_name,
          malak_pan: r.malak_pan,
          kshetra: String(r.kshetra),
          kshetra_unit: r.kshetra_unit,
          jamabandi: r.jamabandi,
          jamin_prakar: r.jamin_prakar,
          bandhak: Boolean(r.bandhak),
          court_case: Boolean(r.court_case),
          district: r.district,
          taluka: r.taluka,
          village: r.village,
          simulateOutage: Boolean(r.simulate_outage)
        };
        records.set(String(r.gtn), rec);
        return rec;
      }
    } catch (e) {
      console.warn('[Land API] DB getRecord error, falling back to map:', e.message);
    }
  }
  return records.get(query) || Array.from(records.values()).find(r => r.malak_pan?.toUpperCase() === query.toUpperCase()) || null;
}

async function getAllRecords() {
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM land_records ORDER BY id ASC');
      if (res.rows && res.rows.length > 0) {
        const list = res.rows.map(r => ({
          gtn: String(r.gtn),
          malak_name: r.malak_name,
          malak_pan: r.malak_pan,
          kshetra: String(r.kshetra),
          kshetra_unit: r.kshetra_unit,
          jamabandi: r.jamabandi,
          jamin_prakar: r.jamin_prakar,
          bandhak: Boolean(r.bandhak),
          court_case: Boolean(r.court_case),
          district: r.district,
          taluka: r.taluka,
          village: r.village,
          simulateOutage: Boolean(r.simulate_outage)
        }));
        list.forEach(item => records.set(item.gtn, item));
        return list;
      }
    } catch (e) {
      console.warn('[Land API] DB getAllRecords error:', e.message);
    }
  }
  return Array.from(records.values());
}

async function saveRecord(rec) {
  const gtn = String(rec.gtn);
  records.set(gtn, rec);

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO land_records (gtn, malak_name, malak_pan, kshetra, kshetra_unit, jamabandi, jamin_prakar, bandhak, court_case, district, taluka, village)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (gtn) DO UPDATE SET
           malak_name = EXCLUDED.malak_name,
           malak_pan = EXCLUDED.malak_pan,
           kshetra = EXCLUDED.kshetra,
           jamabandi = EXCLUDED.jamabandi,
           district = EXCLUDED.district,
           taluka = EXCLUDED.taluka,
           village = EXCLUDED.village`,
        [
          gtn,
          rec.malak_name,
          rec.malak_pan,
          parseFloat(rec.kshetra) || 1.0,
          rec.kshetra_unit || 'HA',
          rec.jamabandi || 'PENDING',
          rec.jamin_prakar || 'INDUSTRIAL',
          rec.bandhak ? 1 : 0,
          rec.court_case ? 1 : 0,
          rec.district || 'Pune',
          rec.taluka || 'Haveli',
          rec.village || 'Wagholi'
        ]
      );
    } catch (e) {
      console.warn('[Land API] DB saveRecord error:', e.message);
    }
  }
  return rec;
}

async function updateMutationStatus(surveyNumber, newStatus) {
  const record = await getRecord(surveyNumber);
  if (!record) return null;
  record.jamabandi = newStatus;
  records.set(String(surveyNumber), record);

  if (pool) {
    try {
      await pool.query('UPDATE land_records SET jamabandi = $1 WHERE gtn = $2', [newStatus, String(surveyNumber)]);
    } catch (err) {
      console.warn('[Land API] Failed to persist mutation update to PostgreSQL:', err.message);
    }
  }
  return record;
}

function listSurveyNumbers() {
  return Array.from(records.keys());
}

module.exports = {
  getRecord,
  getAllRecords,
  saveRecord,
  updateMutationStatus,
  listSurveyNumbers,
  VALID_MUTATION_STATUSES
};
