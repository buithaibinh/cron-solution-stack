import { Schedule } from './schedule';

export class ScheduleHistory extends Schedule {
  public scheduleId?: string;
  public __type: string = 'ScheduleHistory';
  constructor(data?: Partial<ScheduleHistory>) {
    super(data);
  }
}
