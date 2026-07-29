import mysql from "mysql2/promise"

let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) throw new Error("数据库未初始化，请先调用 initPool()")
  return pool
}

export function initPool() {
  pool = mysql.createPool({
    host: "192.168.34.65",
    port: 3306,
    user: "root",
    password: "Info@1234",
    database: "datacop",
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10000,
    charset: "utf8mb4",
  })
}

export async function createDatabase() {
  const conn = await mysql.createConnection({
    host: "192.168.34.65",
    port: 3306,
    user: "root",
    password: "Info@1234",
  })
  await conn.query(`CREATE DATABASE IF NOT EXISTS datacop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await conn.end()
}
