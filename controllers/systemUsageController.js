const deviceUsageService = require("../services/deviceUsageService");

const saveDeviceUsage = async (req, res) => {
  try {
    const response = await deviceUsageService.storeDeviceUsage(req.body);
    res.status(201).json(response);
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(400).json({ error: error.message });
  }
};

module.exports = { saveDeviceUsage };
