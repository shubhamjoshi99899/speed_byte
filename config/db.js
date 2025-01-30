const mysql = require("mysql");

const db = mysql.createPool({
  connectionLimit: 10,
  host: "44.210.2.228",
  port: 3306,
  user: "admin",
  password: "WxS2REpaivcXf0mNRRBdUihIglj0kMs4", // Replace with actual password
  database: "cscdb",
  connectTimeout: 20000,
  acquireTimeout: 20000,
});

db.getConnection((err, connection) => {
  if (err) console.error("Database connection error:", err);
  else {
    console.log("Connected to the database.");
    connection.release();
  }
});

module.exports = db;
