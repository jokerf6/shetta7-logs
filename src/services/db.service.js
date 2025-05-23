import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, // Replace with your MySQL password
  database: process.env.DB_NAME, // Replace with your database name
};

let connection;

export async function connect() {
  if (!connection) {
    connection = await mysql.createConnection(dbConfig);
    console.log("✅ Connected to MySQL");
  }
  return connection;
}

export async function query(sql, params) {
  const conn = await connect();
  const [results] = await conn.execute(sql, params);
  return results;
}
