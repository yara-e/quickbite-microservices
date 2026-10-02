// =====================================================================
// QuickBite — k6 load test (runs locally OR on Grafana Cloud k6)
// =====================================================================

import http from "k6/http";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

// ---------------------------------------------------------------------
// Config (override everything with -e KEY=VALUE)
// ---------------------------------------------------------------------
const ALB_URL =
  __ENV.ALB_URL || "http://alb-1918623630.eu-north-1.elb.amazonaws.com:3000";
const CORE_URL =
  __ENV.CORE_URL || "http://alb-1918623630.eu-north-1.elb.amazonaws.com:3000";
const ORDER_URL =
  __ENV.ORDER_URL ||
  __ENV.ALB_URL ||
  "http://alb-1918623630.eu-north-1.elb.amazonaws.com:4000";
const ACCESS_SECRET = __ENV.ACCESS_SECRET || "your-access-secret-change-me";
const PROFILE = __ENV.PROFILE || "full";
const DURATION = __ENV.DURATION || (PROFILE === "local" ? "30s" : "2m");
const ORDER_PAYMENT_METHOD = __ENV.ORDER_PAYMENT_METHOD || "cod";

// Dataset shape — Matched to Seed Parameters
const DATA = {
  N_RESTAURANTS: Number(__ENV.N_RESTAURANTS || 100),
  N_EG_RESTAURANTS: Number(__ENV.N_EG_RESTAURANTS || 70),
  PPR: Number(__ENV.PPR || 20),
  CUST_BASE: Number(__ENV.CUST_BASE || 400),
  ADDR_BASE: Number(__ENV.ADDR_BASE || 400),
  N_ORDER_CUSTOMERS: Number(__ENV.N_ORDER_CUSTOMERS || 1000),
  KNOWN_IN_STOCK_PRODUCT_ID: Number(__ENV.IN_STOCK_PID || 0),
};

const RATE_SCALE = Number(
  __ENV.RATE_SCALE || (PROFILE === "local" ? 0.012 : 1),
);

const RATES = {
  menu_items: 300,
  restaurants_list: 90,
  restaurant_detail: 40,
  restaurant_branches: 70,
  nearby: 60,
  categories: 30,
  orders_eg: 1.6,
  orders_sa: 0.7,
  customer_orders_eg: 22,
  customer_orders_sa: 10,
};

const placedOrders = new Counter("orders_placed");

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function egRestaurant() {
  return randInt(1, DATA.N_EG_RESTAURANTS);
}

function saRestaurant() {
  return randInt(DATA.N_EG_RESTAURANTS + 1, DATA.N_RESTAURANTS);
}

function anyRestaurant() {
  return randInt(1, DATA.N_RESTAURANTS);
}

function branchOf(r) {
  return (r - 1) * 2 + randInt(1, 2);
}

function productOf(r) {
  if (DATA.KNOWN_IN_STOCK_PRODUCT_ID > 0) {
    return DATA.KNOWN_IN_STOCK_PRODUCT_ID;
  }
  return (r - 1) * DATA.PPR + randInt(1, DATA.PPR);
}

function orderableCustomer() {
  return DATA.CUST_BASE + randInt(1, DATA.N_ORDER_CUSTOMERS);
}

function addressOf(customerId) {
  return customerId;
}

// Mint HS256 JWT matching Node's jsonwebtoken output
function mintToken(userId) {
  const headerObj = { alg: "HS256", typ: "JWT" };
  const header = encoding.b64encode(JSON.stringify(headerObj), "rawurl");

  const nowS = Math.floor(Date.now() / 1000);
  const payloadObj = {
    userId: Number(userId),
    email: `user${userId}@seed.test`,
    role: "customer",
    iat: nowS,
    exp: nowS + 3600,
  };

  const payload = encoding.b64encode(JSON.stringify(payloadObj), "rawurl");
  const data = `${header}.${payload}`;

  const sig = crypto.hmac("sha256", ACCESS_SECRET, data, "base64rawurl");
  return `${data}.${sig}`;
}

// Generates a strictly unique RFC 4122 v4 UUID per iteration
function idempotencyKey() {
  return uuidv4();
}

function logIfFailed(res, endpointName) {
  if (res.status !== 200 && res.status !== 201) {
    if (res.status === 0) {
      console.log(`[NETWORK TIMEOUT/DROP] ${endpointName}`);
    } else {
      const truncatedBody = res.body ? res.body.slice(0, 120) : "null";
      console.log(
        `[HTTP ERROR] ${endpointName} | Status: ${res.status} | Body: ${truncatedBody}`,
      );
    }
  }
}

// ---------------------------------------------------------------------
// Scenario Functions
// ---------------------------------------------------------------------
export function menuItems() {
  const r = anyRestaurant();
  const res = http.get(`${CORE_URL}/api/branches/${branchOf(r)}/products`, {
    tags: { name: "GET /branches/:id/products" },
  });
  logIfFailed(res, "GET /branches/:id/products");
  check(res, { "menu 200": (x) => x.status === 200 });
}

export function restaurantsList() {
  const res = http.get(`${CORE_URL}/api/restaurants?limit=20`, {
    tags: { name: "GET /restaurants" },
  });
  logIfFailed(res, "GET /restaurants");
  check(res, { "restaurants 200": (x) => x.status === 200 });
}

export function restaurantDetail() {
  const res = http.get(`${CORE_URL}/api/restaurants/${anyRestaurant()}`, {
    tags: { name: "GET /restaurants/:id" },
  });
  logIfFailed(res, "GET /restaurants/:id");
  check(res, { "restaurant 200": (x) => x.status === 200 });
}

export function restaurantBranches() {
  const res = http.get(
    `${CORE_URL}/api/restaurants/${anyRestaurant()}/branches`,
    { tags: { name: "GET /restaurants/:id/branches" } },
  );
  logIfFailed(res, "GET /restaurants/:id/branches");
  check(res, { "branches 200": (x) => x.status === 200 });
}

export function nearby() {
  // Coordinates quantized to 2 decimals (~1.1 km grid) to enable cache hits
  const lat = (30.0 + Math.random() * 0.4).toFixed(2);
  const lng = (31.0 + Math.random() * 0.4).toFixed(2);
  const res = http.get(
    `${CORE_URL}/api/branches/nearby?lat=${lat}&lng=${lng}`,
    { tags: { name: "GET /branches/nearby" } },
  );
  logIfFailed(res, "GET /branches/nearby");
  check(res, { "nearby 200": (x) => x.status === 200 });
}

export function categories() {
  const res = http.get(
    `${CORE_URL}/api/restaurants/${anyRestaurant()}/categories`,
    { tags: { name: "GET /restaurants/:id/categories" } },
  );
  logIfFailed(res, "GET /restaurants/:id/categories");
  check(res, { "categories 200": (x) => x.status === 200 });
}

function placeOrder(region, restaurant) {
  const branchId = 1;
  const customerId = orderableCustomer();
  const addressId = addressOf(customerId);
  const token = mintToken(customerId);

  const items = [{ productId: productOf(restaurant), quantity: 1 }];

  const body = JSON.stringify({
    branchId: branchId,
    customerAddressId: addressId,
    paymentMethod: ORDER_PAYMENT_METHOD,
    items: items,
  });

  const res = http.post(`${ORDER_URL}/api/orders`, body, {
    headers: {
      "Content-Type": "application/json",
      "X-Region": region,
      "Idempotency-Key": idempotencyKey(),
      Authorization: "Bearer " + token,
      Cookie: "access_token=" + token,
    },
    tags: { name: "POST /orders" },
  });

  logIfFailed(res, `POST /orders (${region})`);

  const ok = check(res, {
    "order 2xx": (x) => x.status >= 200 && x.status < 300,
  });
  if (ok) placedOrders.add(1);
  return res;
}

export function ordersEg() {
  placeOrder("eg", egRestaurant());
}
export function ordersSa() {
  placeOrder("ksa", saRestaurant());
}

function customerOrders(region) {
  const customerId = orderableCustomer();
  const token = mintToken(customerId);
  const res = http.get(`${ORDER_URL}/api/customer/orders?limit=20`, {
    headers: {
      "X-Region": region,
      Authorization: "Bearer " + token,
      Cookie: "access_token=" + token,
    },
    tags: { name: "GET /customer/orders" },
  });
  logIfFailed(res, `GET /customer/orders (${region})`);
  check(res, { "history 2xx": (x) => x.status >= 200 && x.status < 300 });
}

export function customerOrdersEg() {
  customerOrders("eg");
}
export function customerOrdersSa() {
  customerOrders("ksa");
}

// ---------------------------------------------------------------------
// Options & Scenarios
// ---------------------------------------------------------------------
function scenario(exec, ratePerSec) {
  const effRps = ratePerSec * RATE_SCALE;
  const rate = Math.max(1, Math.round(effRps * 100));
  const pre = Math.max(10, Math.ceil(effRps * 0.5));
  return {
    executor: "constant-arrival-rate",
    exec: exec,
    rate: rate,
    timeUnit: "100s",
    duration: DURATION,
    preAllocatedVUs: pre,
    maxVUs: Math.max(200, pre * 20),
  };
}

export const options = {
  discardResponseBodies: false,
  scenarios: {
    menu_items: scenario("menuItems", RATES.menu_items),
    restaurants_list: scenario("restaurantsList", RATES.restaurants_list),
    restaurant_detail: scenario("restaurantDetail", RATES.restaurant_detail),
    restaurant_branches: scenario(
      "restaurantBranches",
      RATES.restaurant_branches,
    ),
    nearby: scenario("nearby", RATES.nearby),
    categories: scenario("categories", RATES.categories),
    orders_eg: scenario("ordersEg", RATES.orders_eg),
    orders_sa: scenario("ordersSa", RATES.orders_sa),
    customer_orders_eg: scenario("customerOrdersEg", RATES.customer_orders_eg),
    customer_orders_sa: scenario("customerOrdersSa", RATES.customer_orders_sa),
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800", "p(99)<2000"],
  },
};

export function handleSummary(data) {
  return { stdout: customTextSummary(data) };
}

function customTextSummary(data) {
  const m = data.metrics;

  function p(metric, stat) {
    if (!m[metric] || !m[metric].values) return "-";
    const val = m[metric].values[stat];
    return val !== undefined && !isNaN(val) ? Math.round(val) : "-";
  }

  const reqs = m.http_reqs ? m.http_reqs.values.count : 0;
  const rps = m.http_reqs ? Math.round(m.http_reqs.values.rate) : 0;
  const failed = m.http_req_failed
    ? (m.http_req_failed.values.rate * 100).toFixed(2)
    : "-";
  const placed = m.orders_placed ? m.orders_placed.values.count : 0;

  return [
    "",
    "==================================================",
    "              QuickBite Load Test Summary         ",
    "==================================================",
    `  Total Requests : ${reqs} (${rps} req/s)`,
    `  Failed         : ${failed}%`,
    `  Orders Placed  : ${placed}`,
    `  Req Duration   : avg=${p("http_req_duration", "avg")}ms | p95=${p("http_req_duration", "p(95)")}ms | p99=${p("http_req_duration", "p(99)")}ms`,
    "==================================================",
    "",
  ].join("\n");
}