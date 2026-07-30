import mysql from "mysql2/promise"

let pool: mysql.Pool | null = null

const dbConfig = {
  host: process.env.DB_HOST || "192.168.34.65",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Info@1234",
  database: process.env.DB_NAME || "datacop",
}

export function getPool(): mysql.Pool {
  if (!pool) throw new Error("数据库未初始化，请先调用 initPool()")
  return pool
}

export function initPool() {
  pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10000,
    charset: "utf8mb4",
  })
}

export async function createDatabase() {
  const conn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  })
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await conn.end()
}
