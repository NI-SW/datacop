import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"

interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
}

type ConfirmFn = (message: string, title?: string, options?: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

// Promise 化的确认弹窗，替代原生 confirm()
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; title: string; confirmText: string; cancelText: string } | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((message, title = "确认操作", options) => {
    return new Promise<boolean>((resolve) => {
      setState({
        message,
        title,
        confirmText: options?.confirmText || "确认",
        cancelText: options?.cancelText || "取消",
      })
      resolver.current = resolve
    })
  }, [])

  const done = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setState(null)
  }, [])

  // Esc 与点击遮罩均视为取消
  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") done(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [state, done])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={state.title} onClick={() => done(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{state.title}</h3>
            <p className="modal-message">{state.message}</p>
            <div className="modal-actions">
              {/* 默认聚焦取消，避免连按回车误触发危险操作 */}
              <button className="btn btn-outline" autoFocus onClick={() => done(false)}>{state.cancelText}</button>
              <button className="btn btn-danger" onClick={() => done(true)}>{state.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider")
  return ctx
}
