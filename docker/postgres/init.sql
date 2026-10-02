-- Enable PostGIS on core database
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create shard databases for order-service
CREATE DATABASE order_service_eg;
CREATE DATABASE order_service_archive_eg;
CREATE DATABASE order_service_ksa;
CREATE DATABASE order_service_archive_ksa;

-- Enable PostGIS extension on regional databases if needed
\c order_service_eg
CREATE EXTENSION IF NOT EXISTS postgis;

\c order_service_archive_eg
CREATE EXTENSION IF NOT EXISTS postgis;

\c order_service_ksa
CREATE EXTENSION IF NOT EXISTS postgis;

\c order_service_archive_ksa
CREATE EXTENSION IF NOT EXISTS postgis;