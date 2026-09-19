// Load test for live editing: many users, in groups that share a document, each typing at a steady
// rate into one of a few shared paragraphs while every edit fans out to the rest of their group.
//
// Measured: how many connections succeed, and fan-out latency, meaning the time from one user
// sending an edit to another user's socket receiving it. An edit that was sent before the receiving
// socket opened is history, not fan-out (a replica that starts hosting a document replays it to the
// socket that just joined), so it is counted separately as catchup_edits_received. Sender and receivers are all inside this one
// k6 process, so they share a clock.
//
// Run it with deploy/tests/run-load.sh, which generates updates.json, scales the backend, and starts k6.

import { WebSocket } from 'k6/websockets';
import http from 'k6/http';
import encoding from 'k6/encoding';
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';
import { check, sleep } from 'k6';

const API_URL = __ENV.API_URL || 'http://api.localhost:8080';
const WS_URL = __ENV.WS_URL || 'ws://api.localhost:8080';
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '100');
const GROUP_SIZE = parseInt(__ENV.GROUP_SIZE || '10');
const EDIT_EVERY_MS = parseInt(__ENV.EDIT_EVERY_MS || '1000');
const RAMP_S = parseInt(__ENV.RAMP_S || '20');
const HOLD_S = parseInt(__ENV.HOLD_S || '60');
const TOTAL_MS = (RAMP_S + HOLD_S + 5) * 1000;
const NUM_DOCS = Math.ceil(TARGET_VUS / GROUP_SIZE);

const PER_USER = parseInt(__ENV.PER_USER);
const PLACEHOLDER_LEN = 13;
const pool = new SharedArray('updates', () => JSON.parse(open('/work/updates.json')).items);
const SEED = new Uint8Array(encoding.b64decode(open('/work/seed.b64').trim(), 'std'));
let sent = 0;

const fanoutLatency = new Trend('fanout_latency_ms', true);
const connectOk = new Rate('ws_connect_ok');
const editsSent = new Counter('edits_sent');
const editsReceived = new Counter('edits_received');
const catchupReceived = new Counter('catchup_edits_received');
const unexpectedCloses = new Counter('ws_unexpected_closes');

export const options = {
  scenarios: {
    editors: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: `${RAMP_S}s`, target: TARGET_VUS },
        { duration: `${HOLD_S}s`, target: TARGET_VUS },
        { duration: '5s', target: TARGET_VUS },
      ],
      gracefulStop: '15s',
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    ws_connect_ok: ['rate>0.99'],
    fanout_latency_ms: ['p(95)<2000'],
  },
};

export function setup() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const signup = http.post(
    `${API_URL}/create-user`,
    JSON.stringify({ username: `load${stamp}`, email: `load${stamp}@example.com`, password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(signup, { 'signed up': (r) => r.status === 200 });
  const token = signup.json('token');

  const docs = [];
  for (let i = 0; i < NUM_DOCS; i++) {
    const created = http.post(`${API_URL}/docs/new`, '{}', {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    docs.push(created.json('doc_id'));
  }
  return { token, docs };
}

function stampTimestamp(message, offset) {
  const digits = String(Date.now());
  for (let i = 0; i < PLACEHOLDER_LEN; i++) {
    message[offset + i] = digits.charCodeAt(i);
  }
}

function readTimestamp(buffer) {
  const bytes = new Uint8Array(buffer);
  let run = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c >= 48 && c <= 57) {
      run += String.fromCharCode(c);
      if (run.length === PLACEHOLDER_LEN) {
        return parseInt(run);
      }
    } else {
      run = '';
    }
  }
  return null;
}

export default function (data) {
  const vu = exec.vu.idInTest - 1;
  const docId = data.docs[vu % NUM_DOCS];
  const remainingMs = TOTAL_MS - exec.instance.currentTestRunDuration;
  if (remainingMs < 2000) {
    sleep(1);
    return;
  }

  const ws = new WebSocket(`${WS_URL}/ws/docs/${docId}?token=${data.token}`);
  ws.binaryType = 'arraybuffer';
  let closingOnPurpose = false;
  let editTimer = null;
  let openedAt = 0;

  ws.addEventListener('open', () => {
    openedAt = Date.now();
    connectOk.add(true);
    ws.send(new Uint8Array([0, 0, 1, 0]).buffer);
    ws.send(SEED.buffer.slice(0));

    setTimeout(() => {
      editTimer = setInterval(() => {
        if (sent >= PER_USER || ws.readyState !== 1) {
          return;
        }
        const item = pool[vu * PER_USER + sent];
        const message = new Uint8Array(encoding.b64decode(item.m, 'std'));
        stampTimestamp(message, item.o);
        ws.send(message.buffer);
        sent++;
        editsSent.add(1);
      }, EDIT_EVERY_MS);
    }, Math.random() * EDIT_EVERY_MS);
  });

  ws.addEventListener('message', (event) => {
    const buffer = event.data;
    if (buffer.byteLength > 4096) {
      return;
    }
    const first = new Uint8Array(buffer, 0, 2);
    if (first[0] !== 0 || first[1] !== 2) {
      return;
    }
    const sentAt = readTimestamp(buffer);
    if (sentAt === null) {
      return;
    }
    if (sentAt < openedAt) {
      catchupReceived.add(1);
      return;
    }
    fanoutLatency.add(Date.now() - sentAt);
    editsReceived.add(1);
  });

  ws.addEventListener('error', () => {
    connectOk.add(false);
  });

  ws.addEventListener('close', () => {
    if (editTimer !== null) {
      clearInterval(editTimer);
    }
    if (!closingOnPurpose) {
      unexpectedCloses.add(1);
    }
  });

  setTimeout(() => {
    closingOnPurpose = true;
    if (editTimer !== null) {
      clearInterval(editTimer);
    }
    ws.close();
  }, Math.max(remainingMs - 1000, 1000));
}
