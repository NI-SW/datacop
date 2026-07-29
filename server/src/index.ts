import express from "express"
import cors from "cors"
import { initPool } from "./db/connection.ts"
import { initDB } from "./db/schema.ts"
import authRoutes from "./routes/auth.ts"
import projectRoutes from "./routes/projects.ts"
import documentRoutes from "./routes/documents.ts"
import problemRoutes from "./routes/problems.ts"
import userRoutes from "./routes/users.ts"
import settingRoutes from "./routes/settings.ts"
import indexRoutes from "./routes/index.ts"

const app = express()
const PORT = 3001

app.use(cors({ origin: "http://localhost:5173", credentials: true }))
app.use(express.json())

app.use("/api/auth", authRoutes)
app.use("/api/projects", indexRoutes)
app.use("/api/projects", projectRoutes)
app.use("/api/projects", documentRoutes)
app.use("/api/projects", problemRoutes)
app.use("/api/users", userRoutes)
app.use("/api/settings", settingRoutes)

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
