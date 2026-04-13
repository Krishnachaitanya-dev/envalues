import { ChevronDown } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import HelpArticle from './HelpArticle'
import gettingStartedArticle from './articles/GettingStarted'
import flowBuilderArticle from './articles/FlowBuilder'
import triggersArticle from './articles/Triggers'
import whatsAppSetupArticle from './articles/WhatsAppSetup'
import inboxHandoffArticle from './articles/InboxHandoff'
import broadcastingArticle from './articles/Broadcasting'
import schedulerArticle from './articles/Scheduler'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const articles = [
  { id: 'getting-started', label: 'Getting Started', content: gettingStartedArticle },
  {
    id: 'flow-builder',
    label: 'Flow Builder',
    content: flowBuilderArticle,
    sections: [
      { id: 'node-types', label: 'Node Types' },
      { id: 'connections', label: 'Connections' },
      { id: 'variables', label: 'Variables' },
      { id: 'publishing', label: 'Publishing' },
    ],
  },
  { id: 'triggers', label: 'Triggers', content: triggersArticle },
  { id: 'whatsapp-setup', label: 'WhatsApp Setup', content: whatsAppSetupArticle },
  { id: 'inbox-handoff', label: 'Inbox & Handoff', content: inboxHandoffArticle },
  { id: 'broadcasting', label: 'Broadcasting', content: broadcastingArticle },
  { id: 'scheduler', label: 'Scheduler', content: schedulerArticle },
] as const

type ArticleId = (typeof articles)[number]['id']

function isArticleId(value: string | null): value is ArticleId {
  return articles.some((article) => article.id === value)
}

export default function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedArticle = searchParams.get('article')
  const activeArticleId = isArticleId(requestedArticle) ? requestedArticle : 'getting-started'
  const activeArticle = articles.find((article) => article.id === activeArticleId) ?? articles[0]

  const navigateToArticle = (articleId: ArticleId, sectionId?: string) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('article', articleId)
    setSearchParams(nextParams)

    if (sectionId) {
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Help Center</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Learn how to set up WhatsApp, build flows, manage handoff, and send campaigns.
        </p>
      </div>

      <div className="lg:hidden">
        <Select value={activeArticleId} onValueChange={(value) => navigateToArticle(value as ArticleId)}>
          <SelectTrigger className="bg-card border-border text-foreground">
            <SelectValue placeholder="Choose an article" />
          </SelectTrigger>
          <SelectContent>
            {articles.map((article) => (
              <SelectItem key={article.id} value={article.id}>
                {article.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="hidden lg:block w-60 shrink-0 rounded-xl border border-border bg-card p-3">
          <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Articles
          </p>
          <nav className="space-y-1">
            {articles.map((article) => {
              const active = article.id === activeArticleId
              const baseClass =
                'w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors'
              const stateClass = active
                ? 'border-primary/20 bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'

              if ('sections' in article) {
                return (
                  <Collapsible key={article.id} defaultOpen>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => navigateToArticle(article.id)}
                        className={`${baseClass} ${stateClass}`}
                      >
                        {article.label}
                      </button>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="rounded-lg border border-transparent p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          aria-label="Toggle Flow Builder sections"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-1 space-y-1 pl-3">
                      {article.sections.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => navigateToArticle(article.id, section.id)}
                          className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                        >
                          {section.label}
                        </button>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )
              }

              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => navigateToArticle(article.id)}
                  className={`${baseClass} ${stateClass}`}
                >
                  {article.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <HelpArticle title={activeArticle.content.title} sections={activeArticle.content.sections} />
        </div>
      </div>
    </div>
  )
}
