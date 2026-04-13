import { Callout, type HelpArticleContent } from '../HelpArticle'

const inboxHandoffArticle = {
  title: 'Inbox & Handoff',
  sections: [
    {
      id: 'what-is-inbox',
      heading: 'What is Inbox?',
      body: (
        <p>
          Inbox is the live chat panel where agents see real customer
          conversations and reply directly from AlaChat.
        </p>
      ),
    },
    {
      id: 'how-handoff-works',
      heading: 'How handoff works',
      body: (
        <p>
          Add a Handoff node to a flow. When the conversation reaches that node,
          the bot goes silent and waits for an agent to respond in Inbox.
        </p>
      ),
    },
    {
      id: 'inbox-ui',
      heading: 'Inbox UI',
      body: (
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Orange HANDOFF badge:</strong> waiting for an agent.</li>
          <li><strong className="text-foreground">Green ACTIVE badge:</strong> bot is handling the conversation.</li>
          <li>Click a conversation to open it.</li>
          <li>Type a reply and hit Send to reply as an agent.</li>
        </ul>
      ),
    },
    {
      id: 'release-to-bot',
      heading: 'Release to Bot',
      body: (
        <Callout>
          Click Release to Bot when the human conversation is complete and the
          bot should resume handling future messages.
        </Callout>
      ),
    },
    {
      id: 'end-chat',
      heading: 'End Chat',
      body: (
        <p>
          End Chat closes the session entirely. Use it when the issue is solved
          and no further automation should continue for that session.
        </p>
      ),
    },
  ],
} satisfies HelpArticleContent

export default inboxHandoffArticle
