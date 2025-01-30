const db = require("../config/db");

const getAllDevices = () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT * FROM devices", (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

const insertDevice = (device) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO devices_new (device_name, android_id, unique_uuid) 
      VALUES (?, ?, ?)`;

    db.query(
      query,
      [device.device_name, device.android_id, device.unique_uuid],
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });
};

module.exports = { getAllDevices, insertDevice };
