import { Callout, Code, CodeBlock, type HelpArticleContent } from '../HelpArticle'

const nodeTypes = [
  ['Start', 'Entry point for a flow. Every flow needs one Start node.'],
  ['Message', 'Sends text, images, videos, PDFs, or quick reply buttons. WhatsApp quick replies support up to 3 buttons.'],
  ['Input', 'Asks the user a question and saves the reply to a variable, such as {{name}}.'],
  ['Condition', 'Branches the conversation based on a variable value or a text match.'],
  ['API', 'Calls an external webhook or API and can include saved context variables.'],
  ['Delay', 'Pauses execution before continuing, which is useful for follow-up messages.'],
  ['Jump', 'Moves the conversation to another node or another flow.'],
  ['Subflow', 'Runs another flow inside the current flow.'],
  ['Handoff', 'Transfers the conversation to a human agent in Inbox and makes the bot silent.'],
  ['End', 'Closes the active session.'],
] as const

const flowBuilderArticle = {
  title: 'Flow Builder',
  sections: [
    {
      id: 'what-is-flow',
      heading: 'What is a Flow?',
      body: (
        <p>
          A flow is an automated conversation script. It defines what the bot
          sends, what it asks, how it stores answers, and which path the user
          should follow next.
        </p>
      ),
    },
    {
      id: 'node-types',
      heading: 'Node Types',
      body: (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {nodeTypes.map(([name, description]) => (
              <div key={name} className="rounded-lg border border-border bg-muted/20 p-3">
                <h3 className="text-sm font-bold text-foreground">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {description.includes('{{name}}') ? (
                    <>
                      Asks the user a question and saves the reply to a
                      variable, such as <Code>{'{{name}}'}</Code>.
                    </>
                  ) : (
                    description
                  )}
                </p>
              </div>
            ))}
          </div>
          <CodeBlock>{`Message text:
Hi {{name}}, your appointment is confirmed for {{appointment_time}}.`}</CodeBlock>
        </div>
      ),
    },
    {
      id: 'connections',
      heading: 'Connecting nodes',
      body: (
        <p>
          Drag from a node&apos;s right handle to another node&apos;s left
          handle. The connection defines the next step in the conversation.
        </p>
      ),
    },
    {
      id: 'variables',
      heading: 'Using variables',
      body: (
        <div className="space-y-3">
          <p>
            Use <Code>{'{{variable_name}}'}</Code> in message text to replace it
            with a saved value. Input nodes create variables from customer
            replies, and API nodes can use those values when calling external
            systems.
          </p>
          <CodeBlock>{`Input variable:
name

Message:
Thanks {{name}}. Which service do you want to book?`}</CodeBlock>
        </div>
      ),
    },
    {
      id: 'publishing',
      heading: 'Publishing',
      body: (
        <div className="space-y-3">
          <p>
            Click Publish to make a flow live. Click Unpublish to stop the flow
            from receiving new conversations.
          </p>
          <Callout>
            Test changes before publishing if the flow handles live customer
            messages.
          </Callout>
        </div>
      ),
    },
  ],
} satisfies HelpArticleContent

export default flowBuilderArticle
