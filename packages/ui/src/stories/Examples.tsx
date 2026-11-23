/*
 * Storybook helper: a page of labelled examples that show a component in the
 * places the editor will use it.
 */
import type { ReactNode } from 'react'

export function Examples({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas p-6 text-sm text-foreground">
      <div className="grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] items-start gap-5">{children}</div>
    </div>
  )
}

/** One labelled example on an Examples page. */
export function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border bg-panel p-5">
      <h2 className="section-label">{title}</h2>
      {children}
    </section>
  )
}
