import http from 'k6/http';
import { check, sleep, group } from 'k6';

// ─── 1000 Concurrent Users Stress Test Configuration ─────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Phase 1: Ramp-up to 100 users (Warm-up)
    { duration: '45s', target: 500 },   // Phase 2: Scale up to 500 users
    { duration: '1m',  target: 1000 },  // Phase 3: Push to 1,000 peak concurrent users
    { duration: '1m',  target: 1000 },  // Phase 4: Sustain 1,000 users peak stress
    { duration: '30s', target: 0 },     // Phase 5: Graceful ramp-down to 0
  ],
  thresholds: {
    // Under 1000 concurrent users stress, 95% requests should stay within 2.5s
    http_req_duration: ['p(95)<2500'],
    // Allow max 5% error rate during heavy stress
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';

export default function () {
  // ─── 1. Health Check (Public endpoint) ─────────────────────────────────────
  group('1. Health Check', function () {
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'Health status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);

  // ─── 2. Auth Login (Simulate MR / Admin Login) ─────────────────────────────
  let authToken = null;
  group('2. Authentication Flow', function () {
    const loginPayload = JSON.stringify({
      email: __ENV.TEST_EMAIL || 'info@biocrospharma.in',
      password: __ENV.TEST_PASSWORD || 'password123',
    });

    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const loginOk = check(loginRes, {
      'Login status is 200': (r) => r.status === 200,
      'Has accessToken': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.success && body.data && body.data.accessToken) {
            authToken = body.data.accessToken;
            return true;
          }
          return false;
        } catch (_) {
          return false;
        }
      },
    });

    if (!loginOk) {
      console.warn(`[VU ${__VU}] Login failed: ${loginRes.status}`);
    }
  });

  sleep(1);

  // ─── 3. Authenticated Endpoints (Doctors & Products) ───────────────────────
  if (authToken) {
    const authHeaders = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    };

    group('3. Fetch Doctors Master Data', function () {
      const doctorsRes = http.get(`${BASE_URL}/doctors?page=1&limit=20`, authHeaders);
      check(doctorsRes, {
        'Doctors list status is 200': (r) => r.status === 200,
      });
    });

    sleep(1);

    group('4. Fetch Products Catalog', function () {
      const productsRes = http.get(`${BASE_URL}/products?limit=20`, authHeaders);
      check(productsRes, {
        'Products list status is 200': (r) => r.status === 200,
      });
    });
  }

  // Realistic human pause before next cycle
  sleep(2);
}
