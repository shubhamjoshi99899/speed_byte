const deviceRepository = require("../repositories/deviceRepository");

const getDevices = async () => {
  return await deviceRepository.getAllDevices();
};

const addDevice = async (device) => {
  return await deviceRepository.insertDevice(device);
};

module.exports = { getDevices, addDevice };
