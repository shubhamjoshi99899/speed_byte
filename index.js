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

// Helper function to format date-time for SQL
const formatToSQLDateTime = (isoString) => {
  const date = new Date(isoString);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getUTCDate()).padStart(2, "0")} ${String(
    date.getUTCHours()
  ).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(
    date.getUTCSeconds()
  ).padStart(2, "0")}`;
};

// CRUD APIs

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
  const { usageData } = req.body;

  if (!Array.isArray(usageData) || usageData.length === 0) {
    return res.status(400).json({ error: "Invalid or empty usage data" });
  }

  const truncateQuery = `TRUNCATE TABLE app_usage1;`;
  const insertQuery = `
    INSERT INTO app_usage1 (android_id, app_name, start_time, stop_time)
    VALUES (?, ?, CONVERT_TZ(?, 'UTC', 'Asia/Kolkata'), CONVERT_TZ(?, 'UTC', 'Asia/Kolkata'))
  `;

  db.query(truncateQuery, (truncateErr) => {
    if (truncateErr) {
      console.error("Error truncating table:", truncateErr);
      return res.status(500).json({
        error: "Database truncate error",
        details: truncateErr.message,
      });
    }

    const insertPromises = usageData.map((usage) => {
      const { android_id, app_name, start_time, end_time } = usage;
      const formattedStartTime = formatToSQLDateTime(start_time);
      const formattedStopTime = formatToSQLDateTime(end_time);

      return new Promise((resolve, reject) => {
        db.query(
          insertQuery,
          [android_id, app_name, formattedStartTime, formattedStopTime],
          (err, results) => {
            if (err) {
              console.error("Error inserting data:", err);
              reject(err);
            } else {
              resolve(results.insertId);
            }
          }
        );
      });
    });

    Promise.all(insertPromises)
      .then((insertedIds) => {
        res
          .status(201)
          .json({ message: "All data inserted successfully", insertedIds });
      })
      .catch((error) => {
        res.status(500).json({
          error: "Database error during insert",
          details: error.message,
        });
      });
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
