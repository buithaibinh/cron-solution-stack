import parser from 'cron-parser';
export class Schedule {
  public id?: string;
  public expression: string = '*/10 * * * *';
  public tz?: string;
  public startDate?: string; // date is a string in ISO format
  public endDate?: string; // date is a string in ISO format
  public nextRun?: string; // date is a string in ISO format
  public lastRun?: string; // date is a string in ISO format
  public __type: string = 'Schedule';

  constructor(data?: Partial<Schedule>) {
    Object.assign(this, data);
    this.calculateNextRunTime();
  }

  calculateNextRunTime() {
    const { expression, startDate, endDate, tz } = this;
    let nextRunTime: Date | undefined;
    const opts = {
      currentDate: new Date(),
      startDate,
      endDate,
      tz,
      utc: !!tz,
    };
    try {
      const interval = parser.parseExpression(expression, opts);
      nextRunTime = interval.next().toDate();
    } catch (error) {
      console.log('Error: ' + error);
    }

    this.nextRun = nextRunTime ? nextRunTime.toISOString() : undefined;
  }
}
