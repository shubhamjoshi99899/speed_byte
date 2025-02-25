const dataRepository = require("../repositories/dataRepository");
const { getAddressFromCoordinates } = require("../services/locationService");

const formatDateForMySQL = (dateStr) => {
  const date = new Date(dateStr);
  return date.toISOString().slice(0, 19).replace("T", " ");
};

const processAppUsageData = async (usageData) => {
  if (!Array.isArray(usageData) || usageData.length === 0) {
    throw new Error("Invalid or empty usage data");
  }

  const validUsageData = usageData.filter(
    (usage) =>
      usage.android_id &&
      usage.unique_uuid &&
      usage.app_name &&
      usage.start_time &&
      usage.end_time &&
      !isNaN(Date.parse(usage.start_time)) &&
      !isNaN(Date.parse(usage.end_time))
  );

  if (validUsageData.length === 0) {
    throw new Error("No valid usage data found");
  }

  const validUsageDataForMysql = validUsageData.map((usage) => ({
    ...usage,
    start_time: formatDateForMySQL(usage.start_time),
    end_time: formatDateForMySQL(usage.end_time),
  }));

  const uniqueUuid = validUsageDataForMysql[0].unique_uuid;
  const lastSyncResults = await dataRepository.getLastSyncTimes(uniqueUuid);

  const lastSyncMap = lastSyncResults.reduce((acc, row) => {
    acc[row.app_name] = row.last_sync;
    return acc;
  }, {});

  const filteredUsageData = validUsageDataForMysql.filter((usage) => {
    const lastSync = lastSyncMap[usage.app_name];
    return !lastSync || new Date(usage.end_time) > new Date(lastSync);
  });

  if (filteredUsageData.length === 0) {
    return { message: "No new usage data to process", insertedRecords: 0 };
  }

  const usageDataWithLocation = await Promise.all(
    filteredUsageData.map(async (usage) => {
      if (
        typeof usage.latitude !== "number" ||
        typeof usage.longitude !== "number"
      ) {
        return { ...usage, address: "N/A", location: "N/A" };
      }

      try {
        const { exact_location, region } = await getAddressFromCoordinates(
          usage.latitude,
          usage.longitude
        );
        return { ...usage, address: exact_location, location: region };
      } catch (error) {
        console.error(
          `Failed to fetch address for lat: ${usage.latitude}, lng: ${usage.longitude}`
        );
        return { ...usage, address: "Unknown", location: "Unknown" };
      }
    })
  );

  await dataRepository.insertAppUsageData(usageDataWithLocation);

  const maxEndTimes = {};
  usageDataWithLocation.forEach((usage) => {
    if (
      !maxEndTimes[usage.app_name] ||
      new Date(usage.end_time) > new Date(maxEndTimes[usage.app_name].last_sync)
    ) {
      maxEndTimes[usage.app_name] = {
        last_sync: usage.end_time,
        address: usage.address,
        location: usage.location,
      };
    }
  });

  const updateData = Object.entries(maxEndTimes).map(([app_name, data]) => [
    uniqueUuid,
    usageDataWithLocation[0].android_id,
    app_name,
    data.last_sync,
    data.address,
    data.location,
  ]);

  await dataRepository.updateLastSyncTimes(updateData);

  return {
    message: "Data processing complete",
    insertedRecords: usageDataWithLocation.length,
  };
};

const processAppUsageDataWithoutLocation = async (usageData) => {
  if (!Array.isArray(usageData) || usageData.length === 0) {
    console.error("❌ Received empty or invalid usage data");
    throw new Error("Invalid or empty usage data");
  }

  console.log(
    "✅ Raw received usage data:",
    JSON.stringify(usageData, null, 2)
  );

  const validUsageData = usageData.filter(
    (usage) =>
      usage.android_id &&
      usage.unique_uuid &&
      usage.app_name &&
      usage.start_time &&
      usage.end_time &&
      !isNaN(Date.parse(usage.start_time)) &&
      !isNaN(Date.parse(usage.end_time))
  );

  if (validUsageData.length === 0) {
    throw new Error("No valid usage data found");
  }

  const validUsageDataForMysql = validUsageData.map((usage) => ({
    ...usage,
    start_time: formatDateForMySQL(usage.start_time),
    end_time: formatDateForMySQL(usage.end_time),
    address: "N/A",
    location: "N/A",
  }));

  const uniqueUuid = validUsageDataForMysql[0].unique_uuid;
  const lastSyncResults = await dataRepository.getLastSyncTimes(uniqueUuid);

  const lastSyncMap = lastSyncResults.reduce((acc, row) => {
    acc[row.app_name] = row.last_sync;
    return acc;
  }, {});

  const filteredUsageData = validUsageDataForMysql.filter((usage) => {
    const lastSync = lastSyncMap[usage.app_name];
    return !lastSync || new Date(usage.end_time) > new Date(lastSync);
  });

  if (filteredUsageData.length === 0) {
    return { message: "No new usage data to process", insertedRecords: 0 };
  }

  await dataRepository.insertAppUsageDataWithoutLocation(filteredUsageData);

  return {
    message: "Data processing complete",
    insertedRecords: filteredUsageData.length,
  };
};

module.exports = { processAppUsageData, processAppUsageDataWithoutLocation };
