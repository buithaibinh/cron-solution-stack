import aws = require('aws-sdk');
import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client';
import { StorageService } from './storageService';
import { ScanInput, QueryInput } from 'aws-sdk/clients/dynamodb';
import { Schedule } from '../models/schedule';

export class DynamoDBStorageService implements StorageService {
  constructor(
    private readonly tableName: string,
    private readonly docClient: DocumentClient = new aws.DynamoDB.DocumentClient()
  ) {}

  public async getSchedule(id: string): Promise<Schedule | null> {
    try {
      const data = await this.docClient
        .get({
          TableName: this.tableName,
          Key: { id },
          ConsistentRead: true,
        })
        .promise();
      if (data && data.Item) {
        return data.Item as Schedule;
      }
      return null; // return null vs undefined
    } catch (ex) {
      // AWSError
      console.warn('Error getting entry', ex);
      throw ex;
    }
  }

  public async saveSchedule(schedule: Schedule): Promise<void> {
    try {
      await this.docClient
        .put({
          TableName: this.tableName,
          Item: schedule,
        })
        .promise();
    } catch (ex) {
      console.warn('Error saving entry', ex);
      throw ex;
    }
  }

  /**
   * For example, if the scheduler Lambda was running at 3:18,
   * it would determine all scheduled job executions that need to occur in the 3:20-3:30 time span.
   * @returns
   */
  public async getSubsequentSchedules(
    currentDt: Date = new Date()
  ): Promise<Schedule[]> {
    try {
      const result: Schedule[] = [];

      // if the scheduler Lambda was running at 3:18, it would determine all scheduled job executions that need to occur in the 3:20-3:30 time span.
      // after 2 minutes
      const startDate = new Date(currentDt.getTime() + 2 * 60 * 1000);

      // after 10 minutes from startDate
      const endDate = new Date(startDate.getTime() + 10 * 60 * 1000 - 1); // minus 1 millisecond
      console.log('[startDate, endDate] = ', '[', startDate, endDate, ']');
      const data = await this.docClient
        .query({
          TableName: this.tableName,
          IndexName: 'by-type',
          KeyConditionExpression:
            '#type = :type and #nextRun between :start and :end',
          ExpressionAttributeNames: {
            '#type': '__type',
            '#nextRun': 'nextRun',
          },
          ExpressionAttributeValues: {
            ':type': 'Schedule',
            ':start': startDate.toISOString(),
            ':end': endDate.toISOString(),
          },
        })
        .promise();
      result.push(...(data.Items as Schedule[]));

      return result;
    } catch (ex) {
      // AWSError
      console.warn('Error getting all entries', ex);
      throw ex;
    }
  }

  public async getAllSchedules(): Promise<Schedule[]> {
    try {
      const result: Schedule[] = [];
      const params: ScanInput = { TableName: this.tableName };
      while (true) {
        const data = await this.docClient.scan(params).promise();
        result.push(...(data.Items as Schedule[]));

        if (!data.LastEvaluatedKey) {
          break;
        }

        params.ExclusiveStartKey = data.LastEvaluatedKey;
      }

      return result;
    } catch (ex) {
      // AWSError
      console.warn('Error getting all entries', ex);
      throw ex;
    }
  }

  public async deleteSchedule(id: string): Promise<void> {
    try {
      await this.docClient
        .delete({ TableName: this.tableName, Key: { id } })
        .promise();
    } catch (ex) {
      console.warn('Error deleting entry', ex);
      throw ex;
    }
  }
}
