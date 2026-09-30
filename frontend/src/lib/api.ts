const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface EmailAttachment {
  name: string;
  size: number;
  type: string;
  data?: string;
}

export interface EmailItem {
  id?: string;
  emailJobId?: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  status: 'SCHEDULED' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt?: string | null;
  error?: string | null;
}

export interface SchedulePayload {
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  startTime?: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}

export async function fetchScheduledEmails(): Promise<EmailItem[]> {
  const res = await fetch(`${API_URL}/emails/scheduled`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('Failed to fetch scheduled emails');
  const data = await res.json();
  return data.emails;
}

export async function fetchSentEmails(): Promise<EmailItem[]> {
  const res = await fetch(`${API_URL}/emails/sent`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('Failed to fetch sent emails');
  const data = await res.json();
  return data.emails;
}

export async function clearSentEmailsApi(): Promise<{ success: boolean; count?: number }> {
  let res = await fetch(`${API_URL}/emails/sent`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    res = await fetch(`${API_URL}/emails/clear-sent`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to clear sent emails');
  }
  return res.json();
}

export async function deleteEmailById(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/emails/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete email');
  }
  return res.json();
}


export async function searchEmails(query: string): Promise<EmailItem[]> {
  const res = await fetch(`${API_URL}/emails/search?q=${encodeURIComponent(query)}`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  return data.emails;
}

export async function scheduleEmails(payload: SchedulePayload) {
  const res = await fetch(`${API_URL}/schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error ? JSON.stringify(errorData.error) : 'Failed to schedule');
  }
  return res.json();
}

export async function getSlackStatus(): Promise<{ connected: boolean; webhookUrl?: string }> {
  const res = await fetch(`${API_URL}/slack/status`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) return { connected: false };
  return res.json();
}

export async function saveSlackWebhook(webhookUrl: string) {
  const res = await fetch(`${API_URL}/slack/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ webhookUrl }),
  });
  if (!res.ok) throw new Error('Failed to update Slack webhook');
  return res.json();
}

export async function googleLoginApi(userData: { email: string; name?: string; avatar?: string }) {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Authentication failed');
  }
  return res.json();
}

export async function directLoginApi(userData: { email: string; name?: string; avatar?: string }) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Authentication failed');
  }
  return res.json();
}

export async function getMeApi() {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}
