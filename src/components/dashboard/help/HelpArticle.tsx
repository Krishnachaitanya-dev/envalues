import type { ReactNode } from 'react'

export type Section = {
  id?: string
  heading: string
  body: ReactNode
}

export type HelpArticleContent = {
  title: string
  sections: Section[]
}

type HelpArticleProps = HelpArticleContent

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-muted text-primary text-xs font-mono">
      {children}
    </code>
  )
}

export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs text-primary">
      <code className="font-mono whitespace-pre-wrap">{children}</code>
    </pre>
  )
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary leading-relaxed">
      {children}
    </div>
  )
}

export function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-400 leading-relaxed">
      {children}
    </div>
  )
}

export default function HelpArticle({ title, sections }: HelpArticleProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h1 className="text-lg font-bold text-foreground">{title}</h1>

      <div className="mt-5 space-y-6">
        {sections.map((section) => (
          <section key={section.heading} id={section.id} className="scroll-mt-6">
            <h2 className="text-sm font-bold text-foreground mt-6 mb-2 first:mt-0">
              {section.heading}
            </h2>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
