import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { RecordType, Store } from './store';

export class DynamoStore implements Store {
  private doc: DynamoDBDocumentClient;
  constructor(private table: string) {
    this.doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async get<T>(pk: string) {
    const r = await this.doc.send(new GetCommand({ TableName: this.table, Key: { pk } }));
    return r.Item?.data as T | undefined;
  }

  async put(pk: string, value: object, index?: { type: RecordType; sk: string }) {
    await this.doc.send(
      new PutCommand({ TableName: this.table, Item: { pk, data: value, ...(index ?? {}) } }),
    );
  }

  async delete(pk: string) {
    await this.doc.send(new DeleteCommand({ TableName: this.table, Key: { pk } }));
  }

  async list<T>(type: RecordType, range?: { from: string; to: string }) {
    const out: T[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(
        new QueryCommand({
          TableName: this.table,
          IndexName: 'byType',
          KeyConditionExpression: range ? '#t = :t AND sk BETWEEN :a AND :b' : '#t = :t',
          ExpressionAttributeNames: { '#t': 'type' },
          ExpressionAttributeValues: range ? { ':t': type, ':a': range.from, ':b': range.to } : { ':t': type },
          ExclusiveStartKey: start,
        }),
      );
      for (const i of r.Items ?? []) out.push(i.data as T);
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  }

  async next(counter: string, start: number) {
    const r = await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { pk: `COUNTER#${counter}` },
        UpdateExpression: 'SET n = if_not_exists(n, :s) + :one',
        ExpressionAttributeValues: { ':s': start - 1, ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return Number(r.Attributes?.n);
  }
}
