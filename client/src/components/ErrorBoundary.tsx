import { Component, type ErrorInfo, type ReactNode } from "react"

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("页面渲染出错:", error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty" style={{ padding: "120px 24px" }}>
          <p style={{ fontSize: 15, marginBottom: 16 }}>页面出错了，请刷新后重试</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
