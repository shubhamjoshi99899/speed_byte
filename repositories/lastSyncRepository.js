const db = require("../config/db");

const getLastSync = (android_id) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM last_sync WHERE android_id = ?",
      [android_id],
      (err, results) => {
        if (err) reject(err);
        else resolve(results);
      }
    );
  });
};

const upsertLastSync = (android_id, app_name, last_sync) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO last_sync (android_id, app_name, last_sync) 
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE last_sync = VALUES(last_sync)`;

    db.query(query, [android_id, app_name, last_sync], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

module.exports = { getLastSync, upsertLastSync };
