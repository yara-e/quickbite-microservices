-- =====================================================================
-- QuickBite — order-service seed (RDS Free Tier Adjusted Defaults)
-- =====================================================================

\set ON_ERROR_STOP on

-- Default overrides tailored for RDS Free Tier (db.t3.micro / db.t4g.micro)
\if :{?region}            \else \set region            'eg'    \endif
\if :{?currency}          \else \set currency          'EGP'   \endif
\if :{?rest_start}        \else \set rest_start         1       \endif
\if :{?rest_end}          \else \set rest_end           70      \endif  -- Matches EG restaurants from seed-core
\if :{?n_orders}          \else \set n_orders          10000   \endif  -- Reduced from 1M to 10k
\if :{?p_online}          \else \set p_online          50      \endif
\if :{?days}              \else \set days              30      \endif
\if :{?ppr}               \else \set ppr               20      \endif  -- Reduced from 80 to 20 to match core
\if :{?cust_base}         \else \set cust_base         400     \endif  -- Matches seed-core bounds
\if :{?n_order_customers} \else \set n_order_customers 4000    \endif  -- Matches seed-core bounds
\if :{?agent_base}        \else \set agent_base        100     \endif  -- Matches seed-core bounds
\if :{?n_agents}          \else \set n_agents          200     \endif  -- Matches seed-core bounds

\echo '>> seeding shard region=':region' currency=':currency' orders=':n_orders

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Monthly partitions for the orders table
-- ---------------------------------------------------------------------
DO $$
DECLARE
    i   int;
    lo  date;
    hi  date;
    pname text;
BEGIN
    FOR i IN -14..1 LOOP
        lo := (date_trunc('month', now()) + make_interval(months => i))::date;
        hi := (date_trunc('month', now()) + make_interval(months => i + 1))::date;
        pname := 'orders_' || to_char(lo, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF orders FOR VALUES FROM (%L) TO (%L)',
            pname, lo, hi);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. Orders
-- ---------------------------------------------------------------------
INSERT INTO orders (
    id, region, public_id, country_code,
    restaurant_id, restaurant_owner_id, branch_id, customer_id, customer_address_id,
    delivery_lat, delivery_lng, delivery_address_text_snapshot,
    branch_lat, branch_lng,
    status, subtotal, delivery_fee, service_fee, total, commission, currency,
    payment_method, delivery_agent_id,
    created_at, updated_at, accepted_at, ready_at, assigned_at, picked_at, delivered_at, cancelled_at
)
SELECT
    s                                                                       AS id,
    :'region'                                                               AS region,
    gen_random_uuid()                                                       AS public_id,
    :'region'                                                               AS country_code,
    r.restaurant_id,
    r.restaurant_id                                                         AS restaurant_owner_id,
    (r.restaurant_id - 1) * 3 + 1 + (s % 3)                                 AS branch_id,
    :cust_base + 1 + (s % :n_order_customers)                               AS customer_id,
    :cust_base + 1 + (s % :n_order_customers)                               AS customer_address_id,
    (30.0 + (s % 1000) * 0.0005)::decimal(10,7)                             AS delivery_lat,
    (31.0 + (s % 1000) * 0.0005)::decimal(10,7)                             AS delivery_lng,
    'Seed address ' || s                                                    AS delivery_address_text_snapshot,
    (30.0 + (r.restaurant_id % 500) * 0.0008)::decimal(10,7)               AS branch_lat,
    (31.0 + (r.restaurant_id % 500) * 0.0008)::decimal(10,7)               AS branch_lng,
    (ARRAY['delivered','delivered','delivered','delivered','delivered','delivered','delivered',
           'delivered','delivered','delivered','delivered','delivered','delivered','delivered',
           'cancelled','rejected','preparing','ready','accepted','placed'])[1 + (s % 20)] AS status,
    sub.subtotal,
    sub.delivery_fee,
    1000                                                                    AS service_fee,
    sub.subtotal + sub.delivery_fee + 1000                                  AS total,
    (sub.subtotal * 12 / 100)                                               AS commission,
    :'currency'                                                             AS currency,
    CASE WHEN (s % 100) < :p_online THEN 'online' ELSE 'cod' END            AS payment_method,
    CASE WHEN (s % 20) < 14 THEN :agent_base + 1 + (s % :n_agents) END      AS delivery_agent_id,
    ts.created_at,
    ts.created_at                                                           AS updated_at,
    CASE WHEN (s % 20) <> 19 THEN ts.created_at + interval '2 min' END      AS accepted_at,
    CASE WHEN (s % 20) < 18 THEN ts.created_at + interval '18 min' END      AS ready_at,
    CASE WHEN (s % 20) < 14 THEN ts.created_at + interval '20 min' END      AS assigned_at,
    CASE WHEN (s % 20) < 14 THEN ts.created_at + interval '25 min' END      AS picked_at,
    CASE WHEN (s % 20) < 14 THEN ts.created_at + interval '48 min' END      AS delivered_at,
    CASE WHEN (s % 20) = 14 THEN ts.created_at + interval '5 min'  END      AS cancelled_at
FROM generate_series(1, :n_orders) AS s
CROSS JOIN LATERAL (
    SELECT (:rest_start + (s % (:rest_end - :rest_start + 1)))::bigint AS restaurant_id
) AS r
CROSS JOIN LATERAL (
    SELECT (now() - (random() * :days * interval '1 day')) AS created_at
) AS ts
CROSS JOIN LATERAL (
    SELECT
        (3000 + (s % 47) * 250)::int AS subtotal,
        (1000 + (s % 5) * 500)::int  AS delivery_fee
) AS sub;

SELECT setval(pg_get_serial_sequence('orders', 'id'), :n_orders + 1, false);

-- ---------------------------------------------------------------------
-- 3. Order items
-- ---------------------------------------------------------------------
INSERT INTO order_items (
    region, order_id, product_id, quantity, unit_price_snapshot, name_snapshot, image_url_snapshot, line_total, created_at
)
SELECT
    :'region'                                                               AS region,
    o.id                                                                    AS order_id,
    (o.restaurant_id - 1) * :ppr + 1 + ((o.id * 3 + k) % :ppr)             AS product_id,
    (1 + (k % 3))                                                           AS quantity,
    (1500 + ((o.id + k) % 40) * 100)                                        AS unit_price_snapshot,
    'Seed product ' || ((o.id * 3 + k) % :ppr + 1)                         AS name_snapshot,
    NULL                                                                    AS image_url_snapshot,
    (1 + (k % 3)) * (1500 + ((o.id + k) % 40) * 100)                       AS line_total,
    o.created_at
FROM orders o
CROSS JOIN generate_series(0, 2) AS k;

-- ---------------------------------------------------------------------
-- 4. Transactions
-- ---------------------------------------------------------------------
INSERT INTO transactions (
    region, order_id, transaction_type, method, provider_id, provider_reference_id,
    status, amount, currency, src_acc_id, dst_acc_id, created_at, updated_at
)
SELECT
    :'region',
    o.id,
    'charge',
    CASE WHEN o.payment_method = 'online' THEN 'online' ELSE 'cod' END,
    CASE WHEN o.payment_method = 'online' THEN 1 ELSE NULL END,
    CASE WHEN o.payment_method = 'online' THEN 'seed-ref-' || :'region' || '-' || o.id ELSE NULL END,
    CASE WHEN o.status IN ('rejected','cancelled') THEN 'failed' ELSE 'succeeded' END,
    o.total,
    :'currency',
    o.customer_id,
    o.restaurant_owner_id,
    o.created_at,
    o.created_at
FROM orders o;

-- ---------------------------------------------------------------------
-- 5. Payment sessions
-- ---------------------------------------------------------------------
INSERT INTO payment_sessions (
    region, order_id, provider_id, provider_session_id, redirect_url,
    amount, currency, status, raw_init_payload, created_at, updated_at
)
SELECT
    :'region',
    o.id,
    1,
    'seed-sess-' || :'region' || '-' || o.id,
    'https://test-pay.kashier.io/?session=seed-' || o.id,
    o.total,
    :'currency',
    CASE WHEN o.status IN ('rejected','cancelled') THEN 'failed' ELSE 'captured' END,
    '{"seed":true}'::jsonb,
    o.created_at,
    o.created_at
FROM orders o
WHERE o.payment_method = 'online';

-- ---------------------------------------------------------------------
-- 6. Agent earnings
-- ---------------------------------------------------------------------
INSERT INTO agent_earnings (region, agent_id, order_id, amount, currency, earned_at)
SELECT
    :'region',
    o.delivery_agent_id,
    o.id,
    (o.delivery_fee * 80 / 100),
    :'currency',
    COALESCE(o.delivered_at, o.created_at)
FROM orders o
WHERE o.status = 'delivered' AND o.delivery_agent_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 7. Restaurant balances
-- ---------------------------------------------------------------------
INSERT INTO restaurant_balances (restaurant_id, region, currency, balance, updated_at)
SELECT
    rid                                  AS restaurant_id,
    :'region',
    :'currency',
    (50000 + (rid % 100) * 1373)::int    AS balance,
    now()
FROM generate_series(:rest_start, :rest_end) AS rid
ON CONFLICT (restaurant_id, currency) DO NOTHING;

ANALYZE orders;
ANALYZE order_items;
ANALYZE transactions;

\echo '>> done shard region=':region
SELECT
    (SELECT count(*) FROM orders)              AS orders,
    (SELECT count(*) FROM order_items)         AS order_items,
    (SELECT count(*) FROM transactions)        AS transactions,
    (SELECT count(*) FROM payment_sessions)    AS payment_sessions,
    (SELECT count(*) FROM agent_earnings)      AS agent_earnings,
    (SELECT count(*) FROM restaurant_balances) AS balances;


UPDATE product_branch_details 
SET stock = 999999, is_available = true 
WHERE stock <= 0 OR is_available = false;