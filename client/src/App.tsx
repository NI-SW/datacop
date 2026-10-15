import { createBrowserRouter, RouterProvider, Navigate, useParams } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ToastProvider } from "./components/Toast"
import { ConfirmProvider } from "./components/ConfirmDialog"
import ErrorBoundary from "./components/ErrorBoundary"
import ProtectedRoute from "./components/ProtectedRoute"
import Layout from "./components/Layout"
import ProjectLayout from "./components/ProjectLayout"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import ProblemList from "./pages/ProblemList"
import ProblemForm from "./pages/ProblemForm"
import ProblemEdit from "./pages/ProblemEdit"
import ProblemDetail from "./pages/ProblemDetail"
import NotFound from "./pages/NotFound"
import UserManagement from "./pages/admin/UserManagement"
import ProjectManagement from "./pages/admin/ProjectManagement"
import ProjectSettings from "./pages/admin/ProjectSettings"
import SystemSettings from "./pages/admin/SystemSettings"
import ApiKeyManagement from "./pages/admin/ApiKeyManagement"

function ProjectRedirect() {
  const { id } = useParams()
  return <Navigate to={`/projects/${id}/problems`} replace />
}

// 使用 data router：表单页需要 useBlocker 做应用内未保存拦截，
// 它在 <BrowserRouter> + <Routes> 下会抛 "must be used within a data router"
const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Dashboard /> },
          {
            element: <ProjectLayout />,
            children: [
              { path: "/projects/:id", element: <ProjectRedirect /> },
              { path: "/projects/:id/problems", element: <ProblemList /> },
              { path: "/projects/:id/problems/new", element: <ProblemForm /> },
              { path: "/projects/:id/problems/:problemId", element: <ProblemDetail /> },
              { path: "/projects/:id/problems/:problemId/edit", element: <ProblemEdit /> },
            ],
          },
          { path: "/admin/users", element: <UserManagement /> },
          { path: "/admin/projects", element: <ProjectManagement /> },
          { path: "/admin/projects/:id/settings", element: <ProjectSettings /> },
          { path: "/admin/settings", element: <SystemSettings /> },
          { path: "/admin/mcp-keys", element: <ApiKeyManagement /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
