/**
 * Persistent Storage Service
 */
import { Schedule } from '../models/schedule';

export interface StorageService {
  /**
   * Returns a Schedule. Throws an error if not found.
   * @param key
   */
  getSchedule(key: string): Promise<Schedule | null>;

  /**
   * Saves (creates or overwrites) a Schedule. id is required.
   *
   * @param Schedule
   */
  saveSchedule(Schedule: Schedule): Promise<void>;

  /**
   * Returns all Schedules in the database
   */
  getAllSchedules(): Promise<Schedule[]>;

    /**
   * Returns all Subsequent Schedules in the database
   */
  getSubsequentSchedules(currentDt: Date): Promise<Schedule[]>;

  /**
   * Deletes a Schedule if that Schedule exists
   * @param key
   */
  deleteSchedule(key: string): Promise<void>;
}
