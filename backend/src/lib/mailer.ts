import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class SesMailer implements Mailer {
  private ses = new SESv2Client({});
  constructor(private from: string) {}
  async send(m: Mail) {
    await this.ses.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [m.to] },
        ReplyToAddresses: m.replyTo ? [m.replyTo] : undefined,
        Content: {
          Simple: {
            Subject: { Data: m.subject, Charset: 'UTF-8' },
            Body: { Text: { Data: m.text, Charset: 'UTF-8' }, Html: { Data: m.html, Charset: 'UTF-8' } },
          },
        },
      }),
    );
  }
}

/** Collects mail instead of sending it (tests, local dev). */
export class MemoryMailer implements Mailer {
  sent: Mail[] = [];
  async send(m: Mail) {
    this.sent.push(m);
  }
}
