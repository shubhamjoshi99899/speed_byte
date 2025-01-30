const db = require("../config/db");

const getLastSyncTimes = (uniqueUuid) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT app_name, last_sync FROM last_sync_new WHERE unique_uuid = ?`;

    db.query(query, [uniqueUuid], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

const insertAppUsageData = (usageDataArray) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO app_usage_new 
      (android_id, unique_uuid, app_name, start_time, end_time, latitude, longitude, address, location) 
      VALUES ?`;

    const values = usageDataArray.map((usage) => [
      usage.android_id,
      usage.unique_uuid,
      usage.app_name,
      usage.start_time,
      usage.end_time,
      usage.latitude,
      usage.longitude,
      usage.address,
      usage.location,
    ]);

    db.query(query, [values], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

const updateLastSyncTimes = (updates) => {
  return Promise.all(
    updates.map(
      ([uniqueUuid, android_id, app_name, last_sync, address, location]) => {
        return new Promise((resolve, reject) => {
          const query = `
          INSERT INTO last_sync_new (unique_uuid, android_id, app_name, last_sync, address, location)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE last_sync = VALUES(last_sync)`;

          db.query(
            query,
            [uniqueUuid, android_id, app_name, last_sync, address, location],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    )
  );
};

module.exports = { getLastSyncTimes, insertAppUsageData, updateLastSyncTimes };
