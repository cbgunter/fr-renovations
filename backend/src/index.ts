import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createApp } from './app';
import { DynamoStore } from './lib/dynamo-store';
import { SesMailer } from './lib/mailer';
import { S3PhotoStorage } from './lib/photos';

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

const app = createApp({
  store: new DynamoStore(env('TABLE_NAME')),
  mailer: new SesMailer(env('FROM_EMAIL')),
  photos: new S3PhotoStorage(env('WEB_BUCKET')),
  siteUrl: env('SITE_URL'),
});

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> {
  let body: unknown = undefined;
  if (event.body) {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    try {
      body = JSON.parse(raw);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
  }
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const user = claims ? String(claims.username ?? claims.email ?? claims.sub ?? '') || 'admin' : undefined;

  const res = await app({
    method: event.requestContext.http.method,
    path: event.rawPath.replace(/^\/api/, '') || '/',
    query: event.queryStringParameters ?? {},
    body,
    user,
  });

  if (res.raw !== undefined) {
    return { statusCode: res.status, headers: res.headers, body: res.raw };
  }
  return {
    statusCode: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...res.headers },
    body: res.body === undefined ? '' : JSON.stringify(res.body),
  };
}
