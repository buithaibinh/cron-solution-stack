import {  APIGatewayProxyResultV2, ScheduledEvent } from 'aws-lambda';
import { SQSService } from './services/sqsService';
import { DynamoDBStorageService } from './services/dynamoDBStorageService';
import { Schedule } from './models/schedule';

const messageService = new SQSService(process.env.QUEUE_URL!);
const storageService = new DynamoDBStorageService(
  process.env.ITEMS_TABLE_NAME!
);

export const handler = async (
  event?: ScheduledEvent
): Promise<APIGatewayProxyResultV2> => {
  console.log('event 👉', event);

  // 1.  select schedules that were due for execution in the subsequent whole-10-minute interval.
  // current date with begin minutes
  const currentDt = new Date();
  currentDt.setMilliseconds(0);
  currentDt.setSeconds(0);
  const schedules = await storageService.getSubsequentSchedules(currentDt);
  console.log('Total schedules need run:: ', schedules.length);

  // 2. post message with delay to each schedule
  const messages = schedules
    .filter((schedule) => !!schedule.nextRun)
    .map((schedule: Schedule) => {
      // calc difference between current date and nextRun
      const nextRun = new Date(schedule.nextRun!);
      const diff = Math.round((nextRun.getTime() - currentDt.getTime()) / 1000);
      console.log('current time: ', currentDt, '|nextRun:', nextRun);
      console.log('difference between current date and nextRun:: ', diff);
      return messageService.sendMessageWithDelay({
        message: JSON.stringify(schedule),
        delaySeconds: diff,
      });
    });
  await Promise.all(messages);

  // // 2.  for each schedule, calculate the next run time and update the schedule with the new next run time.
  // const tasks = schedules.map((schedule) => {
  //   const nextRunTime = schedule.calculateNextRunTime();
  //   schedule.nextRun = nextRunTime ? nextRunTime.toISOString() : undefined;
  //   return storageService.saveSchedule(schedule);
  // });
  // 3.  return the updated schedules.

  // select those that were due for execution in the subsequent whole-10-minute interval.
  return {
    body: JSON.stringify({ message: 'Successful lambda invocation' }),
    statusCode: 200,
  };
};
