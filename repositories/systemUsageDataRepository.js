const db = require("../config/db");

const saveDeviceUsage = async (data) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO device_usage (android_id, unique_uuid, device_name, os_version, last_reboot)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      last_reboot = VALUES(last_reboot)
    `;

    db.query(
      query,
      [
        data.android_id,
        data.unique_uuid,
        data.device_name,
        data.os_version,
        data.last_reboot,
      ],
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });
};

module.exports = { saveDeviceUsage };
