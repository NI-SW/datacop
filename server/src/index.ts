import express from "express"
import cors from "cors"
import path from "path"
import { initPool } from "./db/connection.ts"
import { initDB } from "./db/schema.ts"
import authRoutes from "./routes/auth.ts"
import projectRoutes from "./routes/projects.ts"
import problemRoutes from "./routes/problems.ts"
import userRoutes from "./routes/users.ts"
import settingRoutes from "./routes/settings.ts"
import mcpKeyRoutes from "./routes/mcpKeys.ts"

const app = express()
const PORT = parseInt(process.env.PORT || "3001", 10)

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: true }))
app.use(express.json({ limit: "50mb" }))

app.use("/api/auth", authRoutes)
app.use("/api/projects", projectRoutes)
app.use("/api/projects", problemRoutes)
app.use("/api/users", userRoutes)
app.use("/api/settings", settingRoutes)
app.use("/api/mcp-keys", mcpKeyRoutes)

// Serve frontend static files in production
const publicDir = path.resolve("public")
app.use(express.static(publicDir))
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"))
})

initPool()
initDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`)
    })
  })
  .catch((e) => {
    console.error("Failed to initialize database:", e)
    process.exit(1)
  })
