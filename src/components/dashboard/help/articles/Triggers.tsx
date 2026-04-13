import { Callout, Code, type HelpArticleContent } from '../HelpArticle'

const triggersArticle = {
  title: 'Triggers',
  sections: [
    {
      id: 'what-are-triggers',
      heading: 'What are triggers?',
      body: (
        <p>
          Triggers are rules that start a flow when a user sends a message.
          They decide which automation should handle the next incoming WhatsApp
          message.
        </p>
      ),
    },
    {
      id: 'trigger-types',
      heading: 'Trigger types',
      body: (
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Keyword:</strong> exact or partial match, such as "hi" or "book appointment".</li>
          <li><strong className="text-foreground">Default:</strong> fires when no keyword matches. Use one default trigger per account.</li>
          <li><strong className="text-foreground">Restart:</strong> kills the active session and restarts a flow, such as "menu" or "start over".</li>
          <li><strong className="text-foreground">API:</strong> starts a flow programmatically from another system.</li>
        </ul>
      ),
    },
    {
      id: 'priority',
      heading: 'Priority',
      body: (
        <p>
          Lower numbers are checked first. Use <Code>0</Code> for the most
          important trigger, especially when a keyword should win over broader
          matches.
        </p>
      ),
    },
    {
      id: 'managing-triggers',
      heading: 'Managing triggers',
      body: (
        <p>
          Click the Triggers button on the canvas, then add or remove triggers
          for the selected flow.
        </p>
      ),
    },
    {
      id: 'tip',
      heading: 'Tip',
      body: (
        <Callout>
          Always add a <Code>hi</Code> keyword trigger as the main entry point
          so customers can reliably open the first menu.
        </Callout>
      ),
    },
  ],
} satisfies HelpArticleContent

export default triggersArticle
