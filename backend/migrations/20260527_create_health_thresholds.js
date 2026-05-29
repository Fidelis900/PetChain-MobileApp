module.exports = {
    up: async (db) => {
      await db.query(`
        CREATE TABLE health_thresholds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pet_id INTEGER NOT NULL,
  
          weight_min REAL,
          weight_max REAL,
  
          temperature_min REAL,
          temperature_max REAL,
  
          heart_rate_min INTEGER,
          heart_rate_max INTEGER,
  
          activity_min REAL,
          activity_max REAL,
  
          locked_by_vet BOOLEAN DEFAULT 0,
  
          updated_by INTEGER,
  
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  
    down: async (db) => {
      await db.query(`DROP TABLE IF EXISTS health_thresholds;`);
    },
  };