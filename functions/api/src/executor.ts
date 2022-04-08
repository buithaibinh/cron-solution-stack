import { SQSEvent, APIGatewayProxyResultV2 } from 'aws-lambda';
import { SQSService } from './services/sqsService';
import { DynamoDBStorageService } from './services/dynamoDBStorageService';
import { Schedule } from './models/schedule';
import { ScheduleHistory } from './models/schedul.history';
import { v4 as uuid4 } from 'uuid';
const storageService = new DynamoDBStorageService(
  process.env.ITEMS_TABLE_NAME!
);

export const handler = async (
  event: SQSEvent
): Promise<APIGatewayProxyResultV2> => {
  console.log('event executor 👉', event);

  // handle sqs message
  const currentDt = new Date();
  currentDt.setMilliseconds(0);
  currentDt.setSeconds(0);

  const messages = event.Records.map(async (record) => {
    const dt = new Date();
    const schedule = new Schedule(JSON.parse(record.body));
    schedule.lastRun =  dt.toISOString();
    const scheduleHistory: ScheduleHistory = new ScheduleHistory({
      ...schedule,
      id: uuid4(),
      scheduleId: schedule.id,
      lastRun: dt.toISOString(),
    });
    await storageService.saveSchedule(schedule);
    return storageService.saveSchedule(scheduleHistory);
  });
  await Promise.all(messages);

  return {
    body: JSON.stringify({ message: 'Successful lambda invocation' }),
    statusCode: 200,
  };
};
