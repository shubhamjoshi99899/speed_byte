const dataService = require("../services/dataService");

const getData = async (req, res) => {
  try {
    const data = await dataService.getAppUsage();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
};

const postData = async (req, res) => {
  try {
    if (!req.body.usageData) {
      return res
        .status(400)
        .json({ error: "Missing usageData array in request body" });
    }

    const hasLocationData = req.body.usageData.some(
      (usage) =>
        typeof usage.latitude === "number" &&
        typeof usage.longitude === "number"
    );

    const result = hasLocationData
      ? await dataService.processAppUsageData(req.body.usageData)
      : await dataService.processAppUsageDataWithoutLocation(
          req.body.usageData
        );

    res.status(201).json(result);
  } catch (err) {
    console.error("Error processing app usage data:", err);
    res.status(500).json({ error: "Database error", details: err.message });
  }
};

module.exports = { getData, postData };
