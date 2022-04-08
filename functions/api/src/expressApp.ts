import {App} from "./app";
import {DynamoDBStorageService} from "./services/dynamoDBStorageService";
import aws = require("aws-sdk");

if (!process.env.ITEMS_TABLE_NAME) {
  throw new Error("Required environment variable ITEMS_TABLE_NAME is missing");
}

if (!process.env.USER_POOL_ID) {
  throw new Error("Required environment variable USER_POOL_ID is missing");
}

if (!process.env.ALLOWED_ORIGIN) {
  throw new Error("Required environment variable ALLOWED_ORIGIN is missing");
}

export const expressApp = new App({
  cognito: new aws.CognitoIdentityServiceProvider(),
  adminsGroupName: process.env.ADMINS_GROUP_NAME || "cron-app-admins",
  usersGroupName: process.env.USERS_GROUP_NAME || "cron-app-users",
  authorizationHeaderName: process.env.AUTHORIZATION_HEADER_NAME || "Authorization",
  userPoolId: process.env.USER_POOL_ID,
  storageService: new DynamoDBStorageService(process.env.ITEMS_TABLE_NAME),
  allowedOrigin: process.env.ALLOWED_ORIGIN,
}).expressApp;
