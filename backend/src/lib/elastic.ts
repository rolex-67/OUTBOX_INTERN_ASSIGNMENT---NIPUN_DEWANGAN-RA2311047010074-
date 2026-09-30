import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.js';
import { db } from './db.js';

export const es = new Client({
  node: env.ELASTICSEARCH_URL,
});

const INDEX_NAME = 'reachinbox-emails';
let isElasticAvailable = false;

export async function initElasticsearch() {
  try {
    await es.ping();
    isElasticAvailable = true;
    console.log('Elasticsearch connected.');

    const exists = await es.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await es.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            emailJobId: { type: 'keyword' },
            userId: { type: 'keyword' },
            sender: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
      console.log(`Created Elasticsearch index: ${INDEX_NAME}`);
    }
  } catch (err: any) {
    isElasticAvailable = false;
    console.warn(`Elasticsearch unavailable (${err.message}). Using database fallback for search.`);
  }
}

export interface EmailDoc {
  emailJobId: string;
  userId?: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
}

export async function indexEmail(doc: EmailDoc) {
  if (!isElasticAvailable) return;

  try {
    await es.index({
      index: INDEX_NAME,
      id: doc.emailJobId,
      document: doc,
      refresh: true,
    });
  } catch (err: any) {
    console.warn(`Failed to index email ${doc.emailJobId} to ES:`, err.message);
  }
}

export async function searchEmails(query: string, userId?: string) {
  if (isElasticAvailable) {
    try {
      const mustClauses: any[] = [
        {
          multi_match: {
            query,
            fields: ['subject^3', 'body', 'recipient^2', 'sender'],
            fuzziness: 'AUTO',
          },
        },
      ];

      if (userId) {
        mustClauses.push({ term: { userId } });
      }

      const res = await es.search<EmailDoc>({
        index: INDEX_NAME,
        query: {
          bool: {
            must: mustClauses,
          },
        },
      });

      return res.hits.hits.map((h) => h._source);
    } catch (err: any) {
      console.warn('ES search failed, falling back to database query:', err.message);
    }
  }

  // Resilient fallback to DB query
  const records = await db.emailJob.findMany({
    where: {
      AND: [
        userId ? { userId } : {},
        {
          OR: [
            { subject: { contains: query } },
            { body: { contains: query } },
            { recipient: { contains: query } },
            { sender: { contains: query } },
          ],
        },
      ],
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });

  return records.map((r) => ({
    emailJobId: r.id,
    userId: r.userId || undefined,
    sender: r.sender,
    recipient: r.recipient,
    subject: r.subject,
    body: r.body,
    status: r.status,
    scheduledAt: r.scheduledAt.toISOString(),
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
  }));
}

export async function deleteSentEmailsFromIndex() {
  if (!isElasticAvailable) return;
  try {
    await es.deleteByQuery({
      index: INDEX_NAME,
      query: {
        terms: {
          status: ['SENT', 'FAILED'],
        },
      },
      refresh: true,
    });
    console.log('Cleared sent emails from Elasticsearch index');
  } catch (err: any) {
    console.warn('Failed to clear sent emails from ES index:', err.message);
  }
}

