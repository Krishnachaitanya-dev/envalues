import { Callout, type HelpArticleContent } from '../HelpArticle'

const schedulerArticle = {
  title: 'Scheduler',
  sections: [
    {
      id: 'what-is-scheduler',
      heading: 'What is the Scheduler?',
      body: (
        <p>
          The Scheduler sends automated reminders and follow-up messages at a
          specific date and time.
        </p>
      ),
    },
    {
      id: 'creating-reminder',
      heading: 'Creating a reminder',
      body: (
        <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
          <li>Go to Scheduler.</li>
          <li>Enter the customer phone number.</li>
          <li>Write the message.</li>
          <li>Choose the date and time.</li>
          <li>Save the scheduled message.</li>
        </ol>
      ),
    },
    {
      id: 'use-cases',
      heading: 'Use cases',
      body: (
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Appointment reminders before a visit.</li>
          <li>Follow-ups after a customer inquiry.</li>
          <li>Re-engagement messages for inactive leads.</li>
        </ul>
      ),
    },
    {
      id: 'cancelling',
      heading: 'Cancelling',
      body: (
        <Callout>
          Delete a scheduled message before it fires to cancel delivery.
        </Callout>
      ),
    },
  ],
} satisfies HelpArticleContent

export default schedulerArticle
