import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import ProjectLayout from "./components/ProjectLayout"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import ProblemList from "./pages/ProblemList"
import ProblemForm from "./pages/ProblemForm"
import ProblemEdit from "./pages/ProblemEdit"
import UserManagement from "./pages/admin/UserManagement"
import ProjectManagement from "./pages/admin/ProjectManagement"
import ProjectSettings from "./pages/admin/ProjectSettings"
import SystemSettings from "./pages/admin/SystemSettings"

function ProjectRedirect() {
  const { id } = useParams()
  return <Navigate to={`/projects/${id}/problems`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route element={<ProjectLayout />}>
                <Route path="/projects/:id" element={<ProjectRedirect />} />
                <Route path="/projects/:id/problems" element={<ProblemList />} />
                <Route path="/projects/:id/problems/new" element={<ProblemForm />} />
                <Route path="/projects/:id/problems/:problemId/edit" element={<ProblemEdit />} />
              </Route>
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/projects" element={<ProjectManagement />} />
              <Route path="/admin/projects/:id/settings" element={<ProjectSettings />} />
              <Route path="/admin/settings" element={<SystemSettings />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
