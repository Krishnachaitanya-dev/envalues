import { Callout, type HelpArticleContent } from '../HelpArticle'

const gettingStartedArticle = {
  title: 'Getting Started',
  sections: [
    {
      id: 'welcome',
      heading: 'Welcome to AlaChat',
      body: (
        <p>
          AlaChat is a WhatsApp chatbot builder for businesses. It helps teams
          automate common conversations, answer customers faster, and hand over
          important chats to a human when needed.
        </p>
      ),
    },
    {
      id: 'quick-start',
      heading: 'Quick Start (5 steps)',
      body: (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
          <li>Connect your WhatsApp number in Settings &gt; WhatsApp.</li>
          <li>Create your first Flow in the Builder.</li>
          <li>Add a Start node and a Message node.</li>
          <li>Set a trigger keyword such as "hi".</li>
          <li>Publish the flow and test it from WhatsApp.</li>
        </ol>
      ),
    },
    {
      id: 'what-you-can-build',
      heading: 'What you can build',
      body: (
        <div className="space-y-3">
          <p>
            You can build appointment bots, lead capture flows, customer support
            assistants, and broadcasts for approved WhatsApp template messages.
          </p>
          <Callout>
            Start small: publish one greeting flow first, then add branching,
            inputs, and handoff after the first customer path works.
          </Callout>
        </div>
      ),
    },
  ],
} satisfies HelpArticleContent

export default gettingStartedArticle
