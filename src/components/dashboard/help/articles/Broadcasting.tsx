import { CodeBlock, WarningBox, type HelpArticleContent } from '../HelpArticle'

const broadcastingArticle = {
  title: 'Broadcasting',
  sections: [
    {
      id: 'what-is-broadcasting',
      heading: 'What is Broadcasting?',
      body: (
        <p>
          Broadcasting sends a WhatsApp message to multiple contacts at once.
          Use it for announcements, reminders, and approved template campaigns.
        </p>
      ),
    },
    {
      id: 'creating-broadcast',
      heading: 'Creating a broadcast',
      body: (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
          <li>Go to the Broadcast page.</li>
          <li>Compose the message or choose an approved template.</li>
          <li>Upload a contacts CSV.</li>
          <li>Review the recipients before sending.</li>
        </ol>
      ),
    },
    {
      id: 'csv-format',
      heading: 'CSV format',
      body: (
        <div>
          <p>Use one phone number per line in international format.</p>
          <CodeBlock>{`+919876543210
+918765432109
+917654321098`}</CodeBlock>
        </div>
      ),
    },
    {
      id: 'scheduling',
      heading: 'Scheduling',
      body: (
        <p>
          Set a send time to schedule the broadcast, or send immediately when
          the campaign is ready.
        </p>
      ),
    },
    {
      id: 'limits',
      heading: 'Limits',
      body: (
        <WarningBox>
          WhatsApp enforces rate limits and message quality rules. AlaChat
          respects those limits while sending campaigns.
        </WarningBox>
      ),
    },
  ],
} satisfies HelpArticleContent

export default broadcastingArticle
