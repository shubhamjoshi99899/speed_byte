const express = require("express");
const mysql = require("mysql");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const { formatISO } = require("date-fns");

// Initialize Express app
const app = express();
const port = 3000;

// Middleware to parse JSON request body
app.use(bodyParser.json());

// Enable CORS for all routes
app.use(
  cors({
    origin: "*", // Allow all origins (can be restricted if needed)
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization",
  })
);

// MySQL connection pool setup
const db = mysql.createPool({
  connectionLimit: 10, // Maximum number of concurrent connections
  host: "44.210.2.228",
  port: 3306,
  user: "admin",
  password: "WxS2REpaivcXf0mNRRBdUihIglj0kMs4", // Replace with actual password
  database: "cscdb",
  connectTimeout: 20000, // Connection timeout in milliseconds (20 seconds)
  acquireTimeout: 20000, // Timeout for acquiring a connection from the pool
});

// Test the connection
db.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Connected to the database.");
    connection.release(); // Release the connection back to the pool
  }
});

// 1. GET all app usage data
app.get("/data", (req, res) => {
  const query = "SELECT * FROM app_usage1";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res
        .status(500)
        .json({ error: "Database error", details: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "No data found" });
    }
    res.json(results);
  });
});

// 2. POST app usage data
app.post("/usage-data", (req, res) => {
  console.log("Function called");
  let { usageData } = req.body;

  if (!Array.isArray(usageData)) {
    if (typeof usageData === "object" && usageData !== null) {
      usageData = [usageData];
    } else {
      return res.status(400).json({ error: "Invalid usage data format" });
    }
  }

  console.log("Received usageData:", usageData);

  if (usageData.length === 0) {
    return res.status(400).json({ error: "No usage data provided" });
  }

  const isValidUsage = (usage) =>
    usage.android_id &&
    usage.app_name &&
    usage.start_time &&
    usage.end_time &&
    !isNaN(Date.parse(usage.start_time)) &&
    !isNaN(Date.parse(usage.end_time));

  const validUsageData = usageData.filter(isValidUsage);
  if (validUsageData.length === 0) {
    return res.status(400).json({ error: "No valid usage data found" });
  }

  // Convert times to MySQL-compatible DATETIME format without changing time
  const formatDateForMySQL = (dateStr) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const validUsageDataForMysql = validUsageData.map((usage) => ({
    ...usage,
    start_time: formatDateForMySQL(usage.start_time),
    end_time: formatDateForMySQL(usage.end_time),
  }));

  console.log("Processed usageData for MySQL:", validUsageDataForMysql);

  const insertQuery = `
    INSERT INTO app_usage (android_id, app_name, start_time, end_time)
    VALUES (?, ?, ?, ?)
  `;

  const insertPromises = validUsageDataForMysql.map((usage) => {
    const { android_id, app_name, start_time, end_time } = usage;

    return new Promise((resolve, reject) => {
      db.query(
        insertQuery,
        [android_id, app_name, start_time, end_time],
        (err, results) => {
          if (err) reject(err);
          else resolve(results.insertId);
        }
      );
    });
  });

  Promise.allSettled(insertPromises)
    .then((results) => {
      const insertedIds = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);
      const rejectedEntries = results
        .filter((result) => result.status === "rejected")
        .map((result, index) => ({
          reason: result.reason.message,
          entry: validUsageDataForMysql[index],
        }));

      res.status(201).json({
        message: "Data processing complete",
        insertedIds,
        failedEntries: rejectedEntries,
      });
    })
    .catch((error) => {
      console.error("Bulk insert error:", error);
      res
        .status(500)
        .json({ error: "Bulk insert error", details: error.message });
    });
});

// 3. Device CRUD APIs
app.post("/devices", (req, res) => {
  const { device_name, android_id } = req.body;
  if (!device_name || !android_id) {
    return res
      .status(400)
      .json({ error: "Device name and Android ID are required" });
  }
  const query = "INSERT INTO devices (device_name, android_id) VALUES (?, ?)";
  db.query(query, [device_name, android_id], (err, result) => {
    if (err) {
      console.error("Error inserting data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res
      .status(201)
      .json({ message: "Device created successfully", id: result.insertId });
  });
});

app.get("/devices", (req, res) => {
  const query = "SELECT * FROM devices";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.status(200).json(results);
  });
});

app.get("/devices/:id", (req, res) => {
  const { id } = req.params;
  const query = "SELECT * FROM devices WHERE id = ?";
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error fetching data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Device not found" });
    }
    res.status(200).json(results[0]);
  });
});

app.put("/devices/:id", (req, res) => {
  const { id } = req.params;
  const { device_name, android_id } = req.body;
  if (!device_name || !android_id) {
    return res
      .status(400)
      .json({ error: "Device name and Android ID are required" });
  }
  const query =
    "UPDATE devices SET device_name = ?, android_id = ? WHERE id = ?";
  db.query(query, [device_name, android_id, id], (err, result) => {
    if (err) {
      console.error("Error updating data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Device not found" });
    }
    res.status(200).json({ message: "Device updated successfully" });
  });
});

app.delete("/devices/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM devices WHERE id = ?";
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error deleting data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Device not found" });
    }
    res.status(200).json({ message: "Device deleted successfully" });
  });
});

// Add "last_sync" table APIs

// 1. POST/PUT endpoint to add or update last sync data
app.post("/last-sync", (req, res) => {
  const { android_id, last_sync } = req.body;

  if (!android_id || !last_sync) {
    return res
      .status(400)
      .json({ error: "Android ID and last sync date are required" });
  }

  const query = `
    INSERT INTO last_sync (android_id, last_sync)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE last_sync = VALUES(last_sync)
  `;

  db.query(query, [android_id, last_sync], (err, result) => {
    if (err) {
      console.error("Error inserting/updating last sync data:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (result.affectedRows > 1) {
      res.status(200).json({ message: "Last sync data updated successfully" });
    } else {
      res
        .status(201)
        .json({
          message: "Last sync data created successfully",
          id: result.insertId,
        });
    }
  });
});

// 2. GET endpoint to retrieve last sync data for a specific android_id
app.get("/last-sync/:android_id", (req, res) => {
  const { android_id } = req.params;

  if (!android_id) {
    return res.status(400).json({ error: "Android ID is required" });
  }

  const query = "SELECT * FROM last_sync WHERE android_id = ?";

  db.query(query, [android_id], (err, results) => {
    if (err) {
      console.error("Error fetching last sync data:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No last sync data found for this Android ID" });
    }

    res.status(200).json(results[0]);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

// Handle database connection shutdown
process.on("SIGINT", () => {
  db.end((err) => {
    if (err) {
      console.error("Error during disconnect: " + err.stack);
    }
    console.log("Disconnected from the database");
    process.exit(0);
  });
});
