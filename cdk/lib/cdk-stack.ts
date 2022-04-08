import {
  Stack,
  StackProps,
  Duration,
  CfnOutput,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
// import { CfnUserPool } from '@aws-cdk/aws-cognito';

import { Utils } from './utils';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const groupsAttributeName = Utils.getEnv('GROUPS_ATTRIBUTE_NAME', 'groups');
    const adminsGroupName = Utils.getEnv(
      'ADMINS_GROUP_NAME',
      'cron-app-admins'
    );
    const usersGroupName = Utils.getEnv('USERS_GROUP_NAME', 'cron-app-users');
    const nodeRuntime: lambda.Runtime = lambda.Runtime.NODEJS_14_X;
    const lambdaMemory = parseInt(Utils.getEnv('LAMBDA_MEMORY', '256'));
    const authorizationHeaderName = 'Authorization';

    // TODO deploy front-end and set corsOrigin
    const corsOrigin = Utils.getEnv('CORS_ORIGIN', '*');

    // ========================================================================
    // Resource: Amazon DynamoDB Table
    // ========================================================================

    // Purpose: serverless, pay as you go, persistent storage for the demo app
    const itemsTable = new dynamodb.Table(this, 'ItemsTable', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    itemsTable.addGlobalSecondaryIndex({
      indexName: 'by-type',
      partitionKey: { name: '__type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'nextRun', type: dynamodb.AttributeType.STRING },
    });

    // ========================================================================
    // Resource: Amazon Cognito User Pool
    // ========================================================================

    // Purpose: creates a user directory and allows federation from external IdPs
    // high level construct
    const userPool: cognito.UserPool = new cognito.UserPool(this, id + 'Pool', {
      selfSignUpEnabled: false, // dont allow users to sign up themselves
      userPoolName: id + 'Pool',
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireDigits: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // any properties that are not part of the high level construct can be added using this method
    const userPoolCfn = userPool.node.defaultChild as cognito.CfnUserPool;
    userPoolCfn.userPoolAddOns = { advancedSecurityMode: 'ENFORCED' };
    userPoolCfn.schema = [
      {
        name: groupsAttributeName,
        attributeDataType: 'String',
        mutable: true,
        required: false,
        stringAttributeConstraints: {
          maxLength: '2000',
        },
      },
    ];

    // create two groups, one for admins one for users
    // these groups can be used without configuring a 3rd party IdP
    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      groupName: adminsGroupName,
      userPoolId: userPool.userPoolId,
    });

    new cognito.CfnUserPoolGroup(this, 'UsersGroup', {
      groupName: usersGroupName,
      userPoolId: userPool.userPoolId,
    });

    // ========================================================================
    // Resource: AWS Lambda Function - CRUD API Backend
    // ========================================================================

    // Purpose: serverless backend for the demo app, uses express.js
    const apiFunction = new lambda.Function(this, 'CronSolutionStackAPI', {
      runtime: nodeRuntime,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../functions/api/dist/src'),
      timeout: Duration.seconds(30),
      memorySize: lambdaMemory,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: {
        ITEMS_TABLE_NAME: itemsTable.tableName,
        ALLOWED_ORIGIN: corsOrigin,
        ADMINS_GROUP_NAME: adminsGroupName,
        USERS_GROUP_NAME: usersGroupName,
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    // grant the lambda full access to the tables (for a high level construct, we have a syntactic sugar way of doing it
    itemsTable.grantReadWriteData(apiFunction.role!);

    // ========================================================================
    // Resource: Amazon API Gateway - API endpoints
    // ========================================================================

    // Purpose: create API endpoints and integrate with Amazon Cognito for JWT validation
    // ------------------------------------------------------------------------
    // The API
    // ------------------------------------------------------------------------

    const api = new apigateway.RestApi(this, id + 'API');
    const integration = new apigateway.LambdaIntegration(apiFunction, {
      // lambda proxy integration:
      // see https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-create-api-as-simple-proxy
      proxy: true,
    });

    // ------------------------------------------------------------------------
    // Cognito Authorizer
    // ------------------------------------------------------------------------

    const cfnAuthorizer = new apigateway.CfnAuthorizer(this, id, {
      name: 'CognitoAuthorizer',
      type: apigateway.AuthorizationType.COGNITO,

      identitySource: 'method.request.header.' + authorizationHeaderName,
      restApiId: api.restApiId,
      providerArns: [userPool.userPoolArn],
    });

    // ------------------------------------------------------------------------
    // Root (/) - no authorization required
    // ------------------------------------------------------------------------
    const rootResource: any = api.root;

    rootResource.addMethod('ANY', integration);

    // ------------------------------------------------------------------------
    // All Other Paths (/{proxy+}) - authorization required
    // ------------------------------------------------------------------------

    // all other paths require the cognito authorizer (validates the JWT and passes it to the lambda)
    const proxyResource: any = rootResource.addResource('{proxy+}');
    const method = proxyResource.addMethod('ANY', integration, {
      // authorizer: { authorizerId: cfnAuthorizer.ref },
      // authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // uncomment to use an access token instead of an id token

    // const cfnMethod = method.node.defaultChild as apigateway.CfnMethod;
    // cfnMethod.authorizationScopes = ["openid"];

    // ------------------------------------------------------------------------
    // Add CORS support to all
    // ------------------------------------------------------------------------

    Utils.addCorsOptions(proxyResource, corsOrigin);
    Utils.addCorsOptions(rootResource, corsOrigin);

    // ------------------------------------------------------------------------
    // scheduler lambda
    // ------------------------------------------------------------------------
    const cronQueue = new sqs.Queue(this, 'CronSolutionStackQueue', {
      visibilityTimeout: Duration.seconds(300),
      retentionPeriod: Duration.days(14),
      removalPolicy: RemovalPolicy.DESTROY,
    });
    // Scheduled CloudWatch Event
    // scheduled CloudWatch Event that triggered the scheduler Lambda function every 10 minutes,
    // starting at minute 8 of an hour. So the scheduler Lambda was running at minute 8, 18, 28, 38 etc. of every hour.
    const rule = new events.Rule(this, 'CronSolutionStackRule', {
      // schedule: events.Schedule.expression('rate(1 minute)'),
      schedule: events.Schedule.cron({
        minute: '8/10',
      }),
    });

    const fnScheduler = new lambda.Function(this, 'schedulerFunction', {
      runtime: nodeRuntime,
      memorySize: lambdaMemory,
      timeout: Duration.seconds(30),
      handler: 'scheduler.handler',
      logRetention: logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromAsset('../functions/api/dist/src'),
      environment: {
        ITEMS_TABLE_NAME: itemsTable.tableName,
        QUEUE_URL: cronQueue.queueUrl,
      },
    });
    // allow the scheduler lambda to access the queue
    cronQueue.grantSendMessages(fnScheduler);
    // grant the scheduler lambda full access to the tables (for a high level construct, we have a syntactic sugar way of doing it
    itemsTable.grantReadWriteData(fnScheduler);

    // add scheduler lambda function event target
    rule.addTarget(
      new targets.LambdaFunction(fnScheduler, {
        maxEventAge: Duration.hours(2), // Optional: set the maxEventAge retry policy
        retryAttempts: 2, // Optional: set the max number of retry attempts
      })
    );

    // ------------------------------------------------------------------------
    // executor lambda
    // ------------------------------------------------------------------------
    const fnExecutor = new lambda.Function(this, 'ExecutorFunction', {
      runtime: nodeRuntime,
      memorySize: lambdaMemory,
      timeout: Duration.seconds(30),
      handler: 'executor.handler',
      logRetention: logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromAsset('../functions/api/dist/src'),
      environment: {
        ITEMS_TABLE_NAME: itemsTable.tableName,
        QUEUE_URL: cronQueue.queueUrl,
      },
    });
    // grant the executor lambda full access to the tables (for a high level construct, we have a syntactic sugar way of doing it
    itemsTable.grantReadWriteData(fnExecutor);

    // sqs trigger
    fnExecutor.addEventSource(
      new SqsEventSource(cronQueue, {
        batchSize: 1, // handle one message at a time
      })
    );

    // Publish the custom resource output
    new CfnOutput(this, 'APIUrlOutput', {
      description: 'API URL',
      value: api.url,
    });

    new CfnOutput(this, 'LambdaAPIFunction', {
      description: 'API Function Name',
      value: apiFunction.functionName,
    });
  }
}
