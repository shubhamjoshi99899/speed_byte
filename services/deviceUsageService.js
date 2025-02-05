const deviceUsageRepository = require("../repositories/systemUsageDataRepository");

const storeDeviceUsage = async (data) => {
  if (!data.android_id || !data.unique_uuid) {
    throw new Error("Missing required fields");
  }

  const insertId = await deviceUsageRepository.saveDeviceUsage(data);
  return { message: "Device usage data stored successfully", id: insertId };
};

module.exports = { storeDeviceUsage };
