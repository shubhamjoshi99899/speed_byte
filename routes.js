const express = require("express");
const dataController = require("./controllers/dataController");
const deviceController = require("./controllers/deviceController");
const usageController = require("./controllers/systemUsageController");
const router = express.Router();

router.get("/data", dataController.getData);
router.post("/usage-data", dataController.postData);

router.get("/devices", deviceController.getDevices);
router.post("/devices", deviceController.postDevice);
router.post("/system-usage", usageController.saveDeviceUsage);

module.exports = router;
