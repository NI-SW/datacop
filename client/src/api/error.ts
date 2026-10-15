import axios from "axios"

// 把 axios 错误统一映射为可直接展示的中文文案
export function apiError(err: unknown, fallback = "操作失败，请重试"): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED" || /timeout/i.test(err.message)) {
      return "请求超时，请检查网络后重试"
    }
    if (!err.response) {
      return "网络连接失败，请检查网络后重试"
    }
    const data = err.response.data as { error?: string } | undefined
    if (data?.error) return data.error
    if (err.response.status === 401) return "登录已过期，请重新登录"
    if (err.response.status === 403) return "没有操作权限"
    if (err.response.status === 404) return "请求的内容不存在"
    return fallback
  }
  return fallback
}
