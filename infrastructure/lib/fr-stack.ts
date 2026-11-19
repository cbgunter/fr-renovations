import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

const here = path.dirname(fileURLToPath(import.meta.url));

const ZONE_NAME = 'caseyhunter.net';
const ZONE_ID = 'Z0040614HEUI57PWWJGI';
const SUBDOMAIN = 'renovations';
const DOMAIN = `${SUBDOMAIN}.${ZONE_NAME}`;
const SITE_URL = `https://${DOMAIN}`;
/** SES-verified domain in this account/region. */
const MAIL_DOMAIN = 'caseyhunter.net';
const GITHUB_REPO = 'cbgunter/fr-renovations';
/** From `gh api repos/cbgunter/fr-renovations/actions/oidc/customization/sub`. */
const GITHUB_REPO_IMMUTABLE = 'cbgunter@10583645/fr-renovations@1464251952';

export class FrRenovationsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---- Data -------------------------------------------------------------
    // One table for everything (see backend/src/lib/store.ts for the key design).
    const table = new dynamodb.Table(this, 'Table', {
      tableName: 'fr-renovations',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // Pennies at this size, and it is the business's only copy of its leads.
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'byType',
      partitionKey: { name: 'type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    // ---- Web bucket (site files + uploaded job photos under photos/) -------
    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `fr-renovations-web-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Photos uploaded by the owner live here, so never auto-delete.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          // The admin uploads photos straight to S3 with a presigned PUT.
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [SITE_URL, 'http://localhost:5173'],
          allowedHeaders: ['Content-Type', 'Cache-Control'],
          maxAge: 3600,
        },
      ],
    });

    // ---- Auth (Cognito, Lite tier = free up to 10k monthly users) ----------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'fr-renovations-admin',
      featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      // Friendly for a non-technical owner, still not trivially guessable.
      passwordPolicy: {
        minLength: 10,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      email: cognito.UserPoolEmail.withSES({
        fromEmail: `noreply@${MAIL_DOMAIN}`,
        fromName: 'First Responder Renovations',
        sesVerifiedDomain: MAIL_DOMAIN,
        sesRegion: this.region,
      }),
      userInvitation: {
        emailSubject: 'Your First Responder Renovations admin login',
        emailBody:
          `Your admin account is ready.<br><br>Go to <a href="${SITE_URL}/admin">${SITE_URL}/admin</a> and sign in with:<br>` +
          'Email: {username}<br>Temporary password: <b>{####}</b><br><br>You will pick your own password the first time you sign in.',
      },
      userVerification: {
        emailSubject: 'Your First Responder Renovations code',
        emailBody: 'Your code is {####}',
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: 'admin-web',
      generateSecret: false,
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      // The owner signs in once per phone and stays signed in for 90 days.
      refreshTokenValidity: cdk.Duration.days(90),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      enableTokenRevocation: true,
    });

    // ---- API ----------------------------------------------------------------
    const apiLogs = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: '/aws/lambda/fr-api',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new lambda.Function(this, 'Api', {
      functionName: 'fr-api',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(here, '../../backend/dist')),
      memorySize: 512,
      timeout: cdk.Duration.seconds(15),
      logGroup: apiLogs,
      environment: {
        TABLE_NAME: table.tableName,
        WEB_BUCKET: webBucket.bucketName,
        SITE_URL,
        FROM_EMAIL: `First Responder Renovations <estimates@${MAIL_DOMAIN}>`,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });
    table.grantReadWriteData(api);
    webBucket.grantPut(api, 'photos/*');
    webBucket.grantRead(api, 'photos/*');
    api.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [webBucket.bucketArn] }),
    );
    api.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/${MAIL_DOMAIN}`, `arn:aws:ses:${this.region}:${this.account}:identity/*`],
      }),
    );

    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'fr-renovations',
      createDefaultStage: false,
    });
    // Throttle so a misbehaving bot can't run up the bill.
    httpApi.addStage('DefaultStage', {
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 40 },
    });

    const integration = new HttpLambdaIntegration('ApiIntegration', api);
    const authorizer = new HttpJwtAuthorizer('CognitoAuthorizer', userPool.userPoolProviderUrl, {
      jwtAudience: [userPoolClient.userPoolClientId],
      identitySource: ['$request.header.Authorization'],
    });
    // Most specific route wins: /api/admin/* always goes through the authorizer.
    httpApi.addRoutes({
      path: '/api/admin/{proxy+}',
      methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST, apigw.HttpMethod.PUT, apigw.HttpMethod.DELETE],
      integration,
      authorizer,
    });
    httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [apigw.HttpMethod.GET, apigw.HttpMethod.POST],
      integration,
    });

    // ---- CDN + domain -------------------------------------------------------
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: ZONE_ID,
      zoneName: ZONE_NAME,
    });
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: DOMAIN,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    // /admin/* and /e/* are the React app; everything else is static files.
    const rewrite = new cloudfront.Function(this, 'RewriteFn', {
      functionName: 'fr-renovations-rewrite',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var r = event.request;
  var u = r.uri;
  var isApp = u === '/admin' || u.indexOf('/admin/') === 0 || u.indexOf('/e/') === 0;
  if (isApp && u.slice(u.lastIndexOf('/')).indexOf('.') === -1) {
    r.uri = '/app.html';
  } else if (u.slice(-1) === '/') {
    r.uri = u + 'index.html';
  }
  return r;
}`),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'First Responder Renovations',
      domainNames: [DOMAIN],
      certificate,
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
        functionAssociations: [{ function: rewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(`${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      // S3 (OAC) answers 403 for a missing file. Serve the 404 page instead.
      // The API never returns 403 (auth failures are 401), so this can't mask API errors.
      errorResponses: [{ httpStatus: 403, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: cdk.Duration.minutes(1) }],
    });

    new route53.ARecord(this, 'AliasA', {
      zone,
      recordName: SUBDOMAIN,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });
    new route53.AaaaRecord(this, 'AliasAAAA', {
      zone,
      recordName: SUBDOMAIN,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // ---- CI/CD: GitHub Actions deploys via OIDC (no stored AWS keys) ----------
    const github = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GithubOidc',
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    );
    const deployRole = new iam.Role(this, 'DeployRole', {
      roleName: 'fr-renovations-deploy',
      description: `GitHub Actions deploys for ${GITHUB_REPO} (main only)`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(github.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          // GitHub may issue either the classic or the immutable (owner@id/repo@id) subject.
          'token.actions.githubusercontent.com:sub': [
            `repo:${GITHUB_REPO}:ref:refs/heads/main`,
            `repo:${GITHUB_REPO_IMMUTABLE}:ref:refs/heads/main`,
          ],
        },
      }),
    });
    // cdk deploy works by assuming the CDK bootstrap roles.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['cloudformation:DescribeStacks'], resources: [this.stackId] }),
    );
    webBucket.grantReadWrite(deployRole);
    webBucket.grantDelete(deployRole);
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
        resources: [`arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`],
      }),
    );

    // ---- Outputs (read by the deploy workflow) ------------------------------
    const out = (k: string, v: string) => new cdk.CfnOutput(this, k, { value: v });
    out('SiteUrl', SITE_URL);
    out('WebBucketName', webBucket.bucketName);
    out('DistributionId', distribution.distributionId);
    out('UserPoolId', userPool.userPoolId);
    out('UserPoolClientId', userPoolClient.userPoolClientId);
    out('DeployRoleArn', deployRole.roleArn);
    out('TableName', table.tableName);
  }
}
