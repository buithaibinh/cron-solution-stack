import { SQS } from 'aws-sdk';

export class SQSService {
  constructor(
    private readonly queueURL: string,
    private readonly client: SQS = new SQS()
  ) {}

  sendMessageWithDelay({
    message,
    delaySeconds,
  }: {
    message: string;
    delaySeconds?: number;
  }): Promise<any> {
    return this.client
      .sendMessage({
        QueueUrl: this.queueURL,
        DelaySeconds: delaySeconds,
        MessageBody: message,
      })
      .promise();
  }
}
