const express = require("express");
const mysql = require("mysql");
const fs = require("fs");
const cors = require("cors"); // Import CORS middleware
const bodyParser = require("body-parser");

// Initialize Express app
const app = express();
const port = 3000;

// Middleware to parse JSON request body
app.use(bodyParser.json());

// Enable CORS for all routes
app.use(cors());

// MySQL connection setup
const db = mysql.createConnection({
  host: "svc-3482219c-a389-4079-b18b-d50662524e8a-shared-dml.aws-virginia-6.svc.singlestore.com",
  port: 3333,
  user: "user_gaurav",
  password: "8nwbHXKwIti3RfuSnSBfLLjOSzqYXyss", // Replace with actual password
  database: "db_gaurav_6d3ba",
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
  const query = "SELECT * FROM app_usage";

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

app.post("/usage_data", (req, res) => {
  const { id, android_id, app_name, start_time, stop_time, total_duration } =
    req.body;
  console.log(id, android_id, app_name, start_time, stop_time, total_duration);

  // Create an insert query
  const query =
    "INSERT INTO app_usage_new (id, android_id, app_name, start_time, stop_time, total_duration) VALUES (?, ?, ?, ?, ?, ?)";

  // Execute the query with the provided values
  db.query(
    query,
    [id, android_id, app_name, start_time, stop_time, total_duration],
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
    "SELECT * FROM devices WHERE android_id = ? OR unique_uuid = ?";
  db.query(checkQuery, [android_id, unique_uuid], (err, results) => {
    if (err) {
      console.error("Error checking existing data:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length > 0) {
      return res
        .status(409)
        .json({
          error:
            "Device with the same Android ID or unique UUID already exists",
        });
    }

    // Insert new entry if no duplicate exists
    const insertQuery =
      "INSERT INTO devices (device_name, android_id, unique_uuid) VALUES (?, ?, ?)";
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
