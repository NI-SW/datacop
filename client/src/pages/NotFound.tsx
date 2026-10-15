import { Link } from "react-router-dom"

export default function NotFound() {
  return (
    <div className="empty" style={{ padding: "120px 24px" }}>
      <p style={{ fontSize: 40, fontWeight: 800, color: "var(--gray-300)", marginBottom: 8 }}>404</p>
      <p style={{ fontSize: 15, marginBottom: 20 }}>页面不存在或已被移除</p>
      <Link to="/" className="btn btn-primary">返回项目列表</Link>
    </div>
  )
}
