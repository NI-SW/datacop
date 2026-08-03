import { getPool, createDatabase } from "./connection.ts"
import bcrypt from "bcryptjs"

export async function initDB() {
  // create database first (before pool)
  await createDatabase()

  // create database if needed
  const pool = getPool()
  const conn = await pool.getConnection()

  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('root', 'admin', 'operator', 'user') NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      operator_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS project_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      user_id INT NOT NULL,
      role ENUM('operator', 'user') NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_project_user (project_id, user_id)
    ) ENGINE=InnoDB
  `)

  // documents table removed — file processing feature deleted
  await conn.query("DROP TABLE IF EXISTS documents")
  console.log("Dropped documents table (feature removed)")

  await conn.query(`
    CREATE TABLE IF NOT EXISTS problems (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      scenario TEXT,
      trigger_method TEXT,
      symptoms TEXT,
      cause TEXT,
      solution TEXT,
      verification TEXT,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_problems_project_id (project_id),
      INDEX idx_problems_status (status),
      INDEX idx_problems_created_by (created_by),
      INDEX idx_problems_created_at (created_at),
      FULLTEXT INDEX ft_problems_name (name),
      FULLTEXT INDEX ft_problems_text (description, scenario, trigger_method, symptoms, cause, solution, verification, notes)
    ) ENGINE=InnoDB
  `)

  await conn.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_name VARCHAR(100) NOT NULL UNIQUE,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)

  // seed root user if not exists
  const [rows] = await conn.query("SELECT id FROM users WHERE username = 'root'") as [any[], any]
  if (rows.length === 0) {
    const hash = await bcrypt.hash("admin123", 10)
    await conn.query("INSERT INTO users (username, password_hash, role) VALUES ('root', ?, 'root')", [hash])
    console.log("Seeded root user (username: root, password: admin123)")
  }

  // Ensure FULLTEXT indexes exist on problems table
  const [idxRows] = await conn.query(
    "SHOW INDEX FROM problems WHERE Key_name LIKE 'ft_%'"
  ) as [any[], any]
  if (idxRows.length === 0) {
    await conn.query("ALTER TABLE problems ADD FULLTEXT INDEX ft_problems_name (name)")
    await conn.query("ALTER TABLE problems ADD FULLTEXT INDEX ft_problems_text (description, scenario, trigger_method, symptoms, cause, solution, verification, notes)")
    console.log("Added FULLTEXT indexes to problems table")
  }

  // Ensure status column exists on problems table
  const [colRows] = await conn.query(
    "SHOW COLUMNS FROM problems LIKE 'status'"
  ) as [any[], any]
  if (colRows.length === 0) {
    await conn.query("ALTER TABLE problems ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'")
    console.log("Added status column to problems table")
  }

  // Drop all foreign key constraints on problems table
  const [createTbl] = await conn.query("SHOW CREATE TABLE problems") as [any[], any]
  const ddl = createTbl[0]?.["Create Table"] || ""
  const allFks = [...ddl.matchAll(/CONSTRAINT\s+`(\w+)`\s+FOREIGN KEY/g)]
  for (const m of allFks) {
    await conn.query(`ALTER TABLE problems DROP FOREIGN KEY \`${m[1]}\``)
    console.log(`Dropped foreign key: ${m[1]}`)
  }

  // Add performance indexes if not present
  const [idxCheck] = await conn.query(
    "SHOW INDEX FROM problems WHERE Key_name IN ('idx_problems_project_id','idx_problems_status','idx_problems_created_by','idx_problems_created_at')"
  ) as [any[], any]
  const existingIdx = new Set(idxCheck.map((r: any) => r.Key_name))
  for (const [key, col] of [["idx_problems_project_id","project_id"],["idx_problems_status","status"],["idx_problems_created_by","created_by"],["idx_problems_created_at","created_at"]] as [string,string][]) {
    if (!existingIdx.has(key)) {
      await conn.query(`ALTER TABLE problems ADD INDEX ${key} (${col})`)
    }
  }
  if (idxCheck.length < 4) console.log("Added performance indexes to problems table")

  conn.release()
  console.log("Database initialized successfully")
}

// run directly
if (process.argv[1]?.includes("schema")) {
  initDB().then(() => process.exit(0)).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
