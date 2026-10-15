import { useEffect, useRef } from "react"
import { useBlocker } from "react-router-dom"
import { useConfirm } from "../components/ConfirmDialog"

/**
 * 表单页共用：拦截「刷新/关闭」与「应用内跳转」，避免未保存内容被静默丢弃。
 * 返回的函数用于提交成功后放行紧随其后的 nav()。
 * 需要 data router（本应用已使用 createBrowserRouter）。
 */
export function useUnsavedChanges(dirty: boolean) {
  const confirm = useConfirm()
  const dirtyRef = useRef(false)
  const savedRef = useRef(false)
  const dialogShown = useRef(false)

  // blocker 的判定函数在导航时执行，必须读取最新值而不是渲染时闭包
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const blocker = useBlocker(() => dirtyRef.current && !savedRef.current)

  useEffect(() => {
    if (blocker.state !== "blocked") {
      dialogShown.current = false
      return
    }
    if (dialogShown.current) return
    dialogShown.current = true
    confirm("当前页面有未保存的内容，离开后填写的内容将丢失。", "放弃未保存的修改", {
      confirmText: "离开",
      cancelText: "留在本页",
    }).then((ok) => {
      ok ? blocker.proceed?.() : blocker.reset?.()
    })
  }, [blocker, confirm])

  return () => {
    savedRef.current = true
  }
}
