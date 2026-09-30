/**
 * ReachInbox Demonstration Script:
 * 1. Server Restart Fault-Tolerance Scenario
 * 2. Rate Limiting & Inter-Email Delay Under Load
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

async function runDemonstration() {
  console.log('===========================================================');
  console.log('REACHINBOX SCHEDULER: SYSTEM DEMONSTRATION');
  console.log('===========================================================\n');

  try {
    // 1. Health check
    const health = await axios.get('http://localhost:5000/health');
    console.log('Backend status:', health.data);

    // 2. Demonstration 1: Scheduled Future Email (Restart Scenario)
    console.log('\n--- 1. DEMO: RESTART SCENARIO (PERSISTENCE) ---');
    const futureTime = new Date(Date.now() + 25000).toISOString(); // 25 seconds in future
    console.log(`Scheduling email for future dispatch at: ${futureTime}`);

    const scheduleRes = await axios.post(`${BASE_URL}/schedule`, {
      sender: 'demo.sender@domain.io',
      recipients: ['future.recipient@example.com'],
      subject: 'Fault Tolerance Restart Verification',
      body: 'This email verifies that stopping and restarting the server does not drop scheduled jobs.',
      startTime: futureTime,
      delayBetweenEmailsMs: 1000,
      hourlyLimit: 50,
    });

    console.log('Job scheduled successfully:');
    console.log('Job IDs:', scheduleRes.data.jobs);

    console.log('\n[RESTART EXPLANATION]');
    console.log('-> If the backend server stops right now (SIGTERM/kill):');
    console.log('   - The job is persisted in MySQL (EmailJob table with status SCHEDULED).');
    console.log('   - The delayed timer is persisted in Redis (bull:email-queue:delayed).');
    console.log('-> When the server starts up again:');
    console.log('   - BullMQ worker re-attaches to Redis and resumes delayed jobs.');
    console.log('   - [Startup Recovery] checks MySQL for any unqueued SCHEDULED jobs and restores them.');
    console.log('   - When the scheduled timestamp arrives, the email is dispatched!');

    // 3. Demonstration 2: Rate Limiting & Inter-Email Delay Under Load
    console.log('\n--- 2. DEMO: RATE LIMITING & DELAY UNDER LOAD ---');
    console.log('Scheduling 5 emails with Hourly Limit = 2, Delay = 2000ms:');

    const rateLimitRes = await axios.post(`${BASE_URL}/schedule`, {
      sender: 'rate.limit.demo@domain.io',
      recipients: [
        'lead1@example.com',
        'lead2@example.com',
        'lead3@example.com',
        'lead4@example.com',
        'lead5@example.com',
      ],
      subject: 'Rate Limit Load Test',
      body: 'Demonstrating hourly quota throttling and inter-email delay.',
      delayBetweenEmailsMs: 2000,
      hourlyLimit: 2,
    });

    console.log(`Dispatched batch with ${rateLimitRes.data.scheduledCount} recipients.`);
    console.log('\n[BEHAVIOR UNDER LOAD]');
    console.log('-> Email 1 & 2: Processed with 2000ms delay between them.');
    console.log('-> Email 3, 4, 5: Exceed hourly limit (2/hour).');
    console.log('   1. Redis atomic counter ratelimit:rate.limit.demo@domain.io:<hour> catches excess.');
    console.log('   2. Slack webhook alert is triggered with hourly limit warning.');
    console.log('   3. BullMQ moves excess jobs to next hour window using moveToDelayed().');
    console.log('   4. MySQL scheduledAt is updated to start of next hour.');
    console.log('   5. ZERO emails dropped, zero domain blacklisting risk.');
    console.log('\n===========================================================');
    console.log('All demonstrations configured and active in the live backend!');
    console.log('View real-time queues at: http://localhost:5000/admin/queues');
    console.log('===========================================================');
  } catch (err: any) {
    console.error('Demo error:', err.response?.data || err.message);
  }
}

runDemonstration();
