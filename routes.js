const express = require("express");
const dataController = require("./controllers/dataController");
const deviceController = require("./controllers/deviceController");

const router = express.Router();

router.get("/data", dataController.getData);
router.post("/usage-data", dataController.postData);

router.get("/devices", deviceController.getDevices);
router.post("/devices", deviceController.postDevice);

module.exports = router;
