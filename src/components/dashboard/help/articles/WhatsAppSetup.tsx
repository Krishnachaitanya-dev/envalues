import { Code, CodeBlock, WarningBox, type HelpArticleContent } from '../HelpArticle'

const whatsAppSetupArticle = {
  title: 'WhatsApp Setup',
  sections: [
    {
      id: 'prerequisites',
      heading: 'Prerequisites',
      body: (
        <p>
          You need a Meta Business account and a WhatsApp Business API app
          before connecting a number to AlaChat.
        </p>
      ),
    },
    {
      id: 'credentials',
      heading: '3 credentials needed',
      body: (
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Business Number:</strong> your WhatsApp phone number, such as <Code>+91XXXXXXXXXX</Code>.</li>
          <li><strong className="text-foreground">Phone Number ID:</strong> found in Meta Developer Portal &gt; WhatsApp &gt; API Setup.</li>
          <li><strong className="text-foreground">Access Token:</strong> permanent system user token from Meta Business Manager.</li>
        </ul>
      ),
    },
    {
      id: 'step-by-step',
      heading: 'Step-by-step setup',
      body: (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
          <li>Open Settings &gt; WhatsApp.</li>
          <li>Enter the business number in international format.</li>
          <li>Paste the Phone Number ID from Meta.</li>
          <li>Paste the permanent access token.</li>
          <li>Save the connection and send a test message.</li>
        </ol>
      ),
    },
    {
      id: 'webhook-url',
      heading: 'Webhook URL',
      body: (
        <div>
          <p>Use this URL in Meta webhook configuration:</p>
          <CodeBlock>https://tbfmturpclqponehhdjq.supabase.co/functions/v1/whatsapp-webhook</CodeBlock>
        </div>
      ),
    },
    {
      id: 'verify-token',
      heading: 'Verify Token',
      body: (
        <p>
          Set the token in Meta webhook config. It must match the
          <Code>WHATSAPP_VERIFY_TOKEN</Code> environment variable used by the
          WhatsApp webhook function.
        </p>
      ),
    },
    {
      id: 'troubleshooting',
      heading: 'Troubleshooting',
      body: (
        <WarningBox>
          Invalid token usually means the access token or verify token is wrong.
          If messages are not arriving, check that the webhook URL is exact and
          subscribed to incoming messages in Meta.
        </WarningBox>
      ),
    },
  ],
} satisfies HelpArticleContent

export default whatsAppSetupArticle
