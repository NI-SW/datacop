import axios from "axios"

const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 认证接口自身的 401（如密码错误）不是会话过期，绝不能触发跳转——
    // 否则登录页会被整页刷新，错误提示永远看不到
    const url: string = err.config?.url || ""
    const isAuthRequest = url.startsWith("/auth/")
    if (err.response?.status === 401 && !isAuthRequest) {
      const hadToken = !!localStorage.getItem("token")
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      // 仅在原本持有会话时才视为过期跳转，并保留原路径方便回跳
      if (hadToken) {
        const returnTo = window.location.pathname + window.location.search
        window.location.href = `/login?expired=1&returnTo=${encodeURIComponent(returnTo)}`
      }
    }
    return Promise.reject(err)
  },
)

export default api
