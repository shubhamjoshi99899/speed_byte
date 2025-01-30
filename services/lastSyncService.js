const lastSyncRepository = require("../repositories/lastSyncRepository");

const getLastSync = async (android_id) => {
  return await lastSyncRepository.getLastSync(android_id);
};

const updateLastSync = async (android_id, app_name, last_sync) => {
  return await lastSyncRepository.upsertLastSync(
    android_id,
    app_name,
    last_sync
  );
};

module.exports = { getLastSync, updateLastSync };
