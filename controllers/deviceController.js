const deviceService = require("../services/deviceService");

const getDevices = async (req, res) => {
  try {
    const devices = await deviceService.getDevices();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
};

const postDevice = async (req, res) => {
  try {
    const device = req.body;
    await deviceService.addDevice(device);
    res.status(201).json({ message: "Device added successfully" });
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err.message });
  }
};

module.exports = { getDevices, postDevice };
