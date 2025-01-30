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
    usage.unique_uuid &&
    usage.app_name &&
    usage.start_time &&
    usage.end_time &&
    !isNaN(Date.parse(usage.start_time)) &&
    !isNaN(Date.parse(usage.end_time)) &&
    usage.latitude !== undefined &&
    usage.longitude !== undefined &&
    usage.address;

  const validUsageData = usageData.filter(isValidUsage);
  if (validUsageData.length === 0) {
    return res.status(400).json({ error: "No valid usage data found" });
  }

  // Convert times to MySQL-compatible DATETIME format
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

  // Step 1: Retrieve last_sync times for all apps based on unique_uuid
  const getLastSyncQuery = `
    SELECT app_name, last_sync 
    FROM last_sync_new 
    WHERE unique_uuid = ?
  `;

  const uniqueUuid = validUsageDataForMysql[0].unique_uuid;

  db.query(getLastSyncQuery, [uniqueUuid], (err, lastSyncResults) => {
    if (err) {
      console.error("Error fetching last sync times:", err);
      return res.status(500).json({ error: "Database error" });
    }

    const lastSyncMap = lastSyncResults.reduce((acc, row) => {
      acc[row.app_name] = row.last_sync;
      return acc;
    }, {});

    // Step 2: Filter usage data based on last_sync times
    const filteredUsageData = validUsageDataForMysql.filter((usage) => {
      const lastSync = lastSyncMap[usage.app_name];
      return !lastSync || new Date(usage.end_time) > new Date(lastSync);
    });

    if (filteredUsageData.length === 0) {
      return res.status(200).json({ message: "No new usage data to process" });
    }

    console.log("Filtered usageData:", filteredUsageData);

    // Step 3: Insert filtered usage data into the usage_data_new table
    const insertQuery = `
      INSERT INTO app_usage_new(android_id, unique_uuid, app_name, start_time, end_time, latitude, longitude, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertPromises = filteredUsageData.map((usage) => {
      const {
        android_id,
        unique_uuid,
        app_name,
        start_time,
        end_time,
        latitude,
        longitude,
        address,
      } = usage;

      return new Promise((resolve, reject) => {
        db.query(
          insertQuery,
          [
            android_id,
            unique_uuid,
            app_name,
            start_time,
            end_time,
            latitude,
            longitude,
            address,
          ],
          (err, results) => {
            if (err) reject(err);
            else resolve(end_time);
          }
        );
      });
    });

    Promise.allSettled(insertPromises)
      .then((results) => {
        const maxEndTimes = {};
        filteredUsageData.forEach((usage, index) => {
          if (results[index].status === "fulfilled") {
            const endTime = usage.end_time;
            if (
              !maxEndTimes[usage.app_name] ||
              new Date(endTime) > new Date(maxEndTimes[usage.app_name])
            ) {
              maxEndTimes[usage.app_name] = endTime;
            }
          }
        });

        // Step 4: Update the last_sync_new table with new max end times
        const updatePromises = Object.entries(maxEndTimes).map(
          ([app_name, last_sync]) => {
            const updateQuery = `
              INSERT INTO last_sync_new (unique_uuid, android_id, app_name, last_sync)
              VALUES (?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE last_sync = VALUES(last_sync)
            `;

            return new Promise((resolve, reject) => {
              db.query(
                updateQuery,
                [uniqueUuid, android_id, app_name, last_sync],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          }
        );

        Promise.all(updatePromises)
          .then(() => {
            res.status(201).json({
              message: "Data processing complete",
              insertedRecords: filteredUsageData.length,
            });
          })
          .catch((updateError) => {
            console.error("Error updating last sync times:", updateError);
            res.status(500).json({
              error: "Error updating last sync times",
              details: updateError.message,
            });
          });
      })
      .catch((insertError) => {
        console.error("Error inserting usage data:", insertError);
        res.status(500).json({
          error: "Error inserting usage data",
          details: insertError.message,
        });
      });
  });
});

app.post("/devices", (req, res) => {
  const { device_name, android_id, unique_uuid } = req.body;

  // Validate input
  if (!device_name || !android_id || !unique_uuid) {
    return res
      .status(400)
      .json({ error: "Device name, Android ID, and unique UUID are required" });
  }

  // Check for existing entry
  const checkQuery =
    "SELECT * FROM devices_new WHERE android_id = ? OR unique_uuid = ?";
  db.query(checkQuery, [android_id, unique_uuid], (err, results) => {
    if (err) {
      console.error("Error checking existing data:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length > 0) {
      return res.status(409).json({
        error: "Device with the same Android ID or unique UUID already exists",
      });
    }

    // Insert new entry if no duplicate exists
    const insertQuery =
      "INSERT INTO devices_new (device_name, android_id, unique_uuid) VALUES (?, ?, ?)";
    db.query(
      insertQuery,
      [device_name, android_id, unique_uuid],
      (err, result) => {
        if (err) {
          console.error("Error inserting data:", err);
          return res.status(500).json({ error: "Database error" });
        }
        res.status(201).json({
          message: "Device created successfully",
          id: result.insertId,
        });
      }
    );
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
  const { android_id, app_name, last_sync } = req.body;

  if (!android_id || !app_name || !last_sync) {
    return res
      .status(400)
      .json({ error: "Android ID, app name, and last sync date are required" });
  }

  const query = `
    INSERT INTO last_sync (android_id, app_name, last_sync)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE last_sync = VALUES(last_sync)
  `;

  db.query(query, [android_id, app_name, last_sync], (err, result) => {
    if (err) {
      console.error("Error inserting/updating last sync data:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (result.affectedRows > 1) {
      res.status(200).json({ message: "Last sync data updated successfully" });
    } else {
      res.status(201).json({
        message: "Last sync data created successfully",
        id: result.insertId,
      });
    }
  });
});

// GET endpoint to retrieve last sync data for a specific android_id (and optionally app_name)
app.get("/last-sync/:android_id", (req, res) => {
  const { android_id } = req.params;
  const { app_name } = req.query; // Optional app_name query parameter

  if (!android_id) {
    return res.status(400).json({ error: "Android ID is required" });
  }

  let query = "SELECT * FROM last_sync WHERE android_id = ?";
  const params = [android_id];

  // If app_name is provided, add it to the query
  if (app_name) {
    query += " AND app_name = ?";
    params.push(app_name);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("Error fetching last sync data:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({
        message: app_name
          ? `No last sync data found for Android ID ${android_id} and app name ${app_name}`
          : `No last sync data found for Android ID ${android_id}`,
      });
    }

    res.status(200).json(results);
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
