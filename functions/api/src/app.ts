import express = require('express');
import CognitoIdentityServiceProvider = require('aws-sdk/clients/cognitoidentityserviceprovider');
import { Express, json, Request, Response, urlencoded } from 'express';
import cors from 'cors';
import { eventContext } from 'aws-serverless-express/middleware';

import { v4 as uuid4 } from 'uuid';
import { authorizationMiddleware } from './services/authorizationMiddleware';
import { StorageService } from './services/storageService';
import { Schedule } from './models/schedule';

export interface AppOptions {
  adminsGroupName: string;
  usersGroupName: string;
  authorizationHeaderName?: string;
  allowedOrigin: string;
  userPoolId: string;
  storageService: StorageService;
  cognito: CognitoIdentityServiceProvider;
  expressApp?: Express; // intended for unit testing / mock purposes
}

/**
 * Using a separate class to allow easier unit testing
 * All dependencies are provided on the constructor to allow easier mocking
 * This is not intended to be an exemplary idiomatic express.js app
 * A lot of shortcuts have been made for brevity
 */
export class App {
  constructor(
    private opts: AppOptions,
    public expressApp: Express = express()
  ) {
    const app = expressApp;

    app.use(
      cors({
        credentials: false,
        origin: [opts.allowedOrigin],
      })
    );

    app.use(json());
    app.use(urlencoded({ extended: true }));

    app.use(eventContext());

    app.use(
      authorizationMiddleware({
        authorizationHeaderName: opts.authorizationHeaderName,
        supportedGroups: [opts.adminsGroupName, opts.usersGroupName],
        allowedPaths: ['/', '/schedules'],
      })
    );

    /**
     * Ping
     */
    app.get('/', async (req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    /**
     * List all Schedules
     */
    app.get('/schedules', async (req: Request, res: Response) => {
      // current date with begin minutes
      const currentDt = new Date();
      currentDt.setMilliseconds(0);
      currentDt.setSeconds(0);
      res.json(await opts.storageService.getSubsequentSchedules(currentDt));
    });

    /**
     * Get a Schedule
     */
    app.get('/schedules/:scheduleId', async (req: Request, res: Response) => {
      const scheduleId = req.params.scheduleId;

      const schedule = await opts.storageService.getSchedule(scheduleId);

      if (!schedule) {
        res
          .status(404)
          .json({ error: `Schedule with id ${scheduleId} was not found` });
        return;
      }

      return res.json(schedule);
    });

    /**
     * Create a Schedule
     */
    app.post('/schedules', async (req: Request, res: Response) => {
      const schedule: Schedule = new Schedule(req.body);

      // TODO: make sure body is parsed as JSON, post and put stopped working
      console.log('post /schedules ', typeof Schedule, schedule);

      if (schedule.id) {
        res.status(400).json({
          error:
            'POST /schedule auto assigns an id. In order to update use PUT /Schedule',
        });
        return;
      }

      // auto generate an ID
      schedule.id = uuid4();
      await opts.storageService.saveSchedule(schedule);
      res.json(schedule);
    });

    /**
     * Update a Schedule
     */
    app.put('/schedules/:scheduleId', async (req: Request, res: Response) => {
      const updatedSchedule: Schedule = new Schedule(req.body);
      const scheduleId = req.params.scheduleId;

      if (!scheduleId) {
        res
          .status(400)
          .json({ error: 'Invalid request - missing Schedule ID' });
        return;
      }
      if (!updatedSchedule) {
        res.status(400).json({ error: 'Invalid request - missing Schedule' });
        return;
      }
      if (updatedSchedule.id !== scheduleId) {
        res.status(400).json({
          error: "Invalid request - Schedule.id doesn't match request param",
        });
        return;
      }
      const existingSchedule = await opts.storageService.getSchedule(
        scheduleId
      );

      if (!existingSchedule) {
        res
          .status(404)
          .json({ error: `Schedule with id ${scheduleId} was not found` });
        return;
      }
      await opts.storageService.saveSchedule(updatedSchedule);
      res.json(updatedSchedule);
    });

    /**
     * Delete a Schedule
     */
    app.delete(
      '/schedules/:scheduleId',
      async (req: Request, res: Response) => {
        const scheduleId = req.params.ScheduleId;
        const schedule = await opts.storageService.getSchedule(scheduleId);

        if (!schedule) {
          res
            .status(404)
            .json({ error: `schedule with id ${scheduleId} was not found` });
          return;
        }

        await opts.storageService.deleteSchedule(scheduleId);
        res.json(schedule);
      }
    );
  }
}
