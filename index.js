const express = require("express");
const mysql = require("mysql");
const fs = require("fs");
const cors = require("cors"); // Import CORS middleware
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
    origin: "*", // Replace with specific origins if needed, e.g., 'http://example.com'
    methods: "GET,POST,PUT,DELETE", // Allowed HTTP methods
    allowedHeaders: "Content-Type,Authorization", // Allowed headers
  })
);

// MySQL connection setup
const db = mysql.createConnection({
  host: "svc-2982b738-4c16-4976-a48e-6df07a8703af-dml.aws-singapore-1.svc.singlestore.com",
  port: 3306,
  user: "admin",
  password: "WxS2REpaivcXf0mNRRBdUihIglj0kMs4", // Replace with actual password
  database: "cscdb",
  ssl: {
    ca: fs.readFileSync("./singlestore_bundle.pem"), // Replace with actual path to the CA certificate
  },
  connectTimeout: 10000,
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error("Error connecting: " + err.stack);
    return;
  }
  console.log("Connected as id " + db.threadId);
});

app.get("/data", (req, res) => {
  // SQL query to select all data from the 'app_usage' table
  const query = "SELECT * FROM app_usage1";

  // Execute the query
  db.query(query, (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res
        .status(500)
        .json({ error: "Database error", details: err.message });
    }

    // Check if results are empty
    if (results.length === 0) {
      return res.status(404).json({ message: "No data found" });
    }

    // Return the results as JSON
    res.json(results);
  });
});

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

  // Function to format to SQL-friendly datetime format
  const formatToSQLDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 19).replace("T", " ");
  };

  db.query(truncateQuery, (truncateErr) => {
    if (truncateErr) {
      console.error("Error truncating table:", truncateErr);
      return res
        .status(500)
        .json({
          error: "Database truncate error",
          details: truncateErr.message,
        });
    }

    const insertPromises = usageData.map((usage) => {
      const { android_id, app_name, start_time, end_time } = usage;
      const formattedStartTime = formatToSQLDateTime(start_time);
      const formattedStopTime = formatToSQLDateTime(end_time);

      console.log(
        `Inserting: Start Time (UTC formatted): ${formattedStartTime}, Stop Time (UTC formatted): ${formattedStopTime}`
      );

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
        res
          .status(500)
          .json({
            error: "Database error during insert",
            details: error.message,
          });
      });
  });
});

app.post("/data", (req, res) => {
  const { id, android_id, app_name, start_time, stop_time } = req.body;

  // Create an insert query
  const query =
    "INSERT INTO app_usage (id, android_id, app_name, start_time, stop_time ) VALUES (?, ?, ?, ?, ?)";

  // Execute the query with the provided values
  console.log(query);
  db.query(
    query,
    [id, android_id, app_name, start_time, stop_time],
    (err, results) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
        return;
      }
      res
        .status(201)
        .json({ message: "Data inserted successfully", id: results.insertId });
    }
  );
});

/// CRUD API for table with fields `id`, `device_name`, and `android_id`

// 1. CREATE a new device entry (POST /devices)
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
    res.status(201).json({
      message: "Device created successfully",
      id: result.insertId,
    });
  });
});

// 2. READ all device entries (GET /devices)
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

// 3. READ a specific device entry by ID (GET /devices/:id)
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

// 4. UPDATE a device entry by ID (PUT /devices/:id)
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

// 5. DELETE a device entry by ID (DELETE /devices/:id)
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

// Remember to close the connection when the server shuts down
process.on("SIGINT", () => {
  db.end((err) => {
    if (err) {
      console.error("Error during disconnect: " + err.stack);
    }
    console.log("Disconnected from the database");
    process.exit(0);
  });
});
