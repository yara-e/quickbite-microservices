import {db} from "../../src/lib/knex/knex";
import {OrderEntity} from "../../src/app/order/entity/order.entity";
import {OrderItemEntity} from "../../src/app/order/entity/order-item.entity";
import {
    OrderStatus,
    PaymentMethod,
    Currency,
} from "../../src/app/order/enums";
import {
    PaymentSessionStatus,
    TransactionType,
    TransactionMethod,
    TransactionStatus,
    PAYMENT_PROVIDER_IDS,
    PaymentProviderName,
} from "../../src/app/payment/enums";

/**
 * Insert a test order directly into the region's hot shard.
 * Returns the row as an OrderEntity.
 */
export interface SeedOrderOptions {
    region: string;
    publicId?: string;
    restaurantId?: number;
    restaurantOwnerId?: number;
    branchId?: number;
    customerId?: number;
    customerAddressId?: number;
    status?: OrderStatus;
    paymentMethod?: PaymentMethod;
    currency?: Currency;
    subtotal?: number;
    deliveryFee?: number;
    serviceFee?: number;
    total?: number;
    deliveryAgentId?: number | null;
    deliveryLat?: number;
    deliveryLng?: number;
    deliveryAddressTextSnapshot?: string;
    branchLat?: number;
    branchLng?: number;
    /** relative offsets from now for createdAt (e.g. -10 = 10s ago) */
    createdAtOffsetSec?: number;
    acceptedAt?: Date | null;
    cancelledAt?: Date | null;
    assignedAt?: Date | null;
    pickedAt?: Date | null;
    deliveredAt?: Date | null;
}

export function seedOrder(conn: any, opts: SeedOrderOptions): Promise<OrderEntity> {
    const now = opts.createdAtOffsetSec
        ? new Date(Date.now() + opts.createdAtOffsetSec * 1000)
        : new Date();
    const total =
        opts.total ?? (opts.subtotal ?? 5000) + (opts.deliveryFee ?? 500) + (opts.serviceFee ?? 1000);

    return conn("orders")
        .insert({
            region: opts.region,
            public_id: opts.publicId ?? cryptoUuid(),
            country_code: opts.currency === Currency.SAR ? "SA" : "EG",
            restaurant_id: opts.restaurantId ?? 1,
            restaurant_owner_id: opts.restaurantOwnerId ?? 1,
            branch_id: opts.branchId ?? 1,
            customer_id: opts.customerId ?? 1,
            customer_address_id: opts.customerAddressId ?? 1,
            delivery_lat: opts.deliveryLat ?? 30.0444,
            delivery_lng: opts.deliveryLng ?? 31.2357,
            delivery_address_text_snapshot: opts.deliveryAddressTextSnapshot ?? "1 Test St",
            branch_lat: opts.branchLat ?? 30.05,
            branch_lng: opts.branchLng ?? 31.24,
            status: opts.status ?? OrderStatus.PLACED,
            subtotal: opts.subtotal ?? 5000,
            delivery_fee: opts.deliveryFee ?? 500,
            service_fee: opts.serviceFee ?? 1000,
            total,
            commission: 0,
            currency: opts.currency ?? Currency.EGP,
            payment_method: opts.paymentMethod ?? PaymentMethod.COD,
            delivery_agent_id: opts.deliveryAgentId ?? null,
            created_at: now,
            updated_at: now,
            accepted_at: opts.acceptedAt ?? null,
            cancelled_at: opts.cancelledAt ?? null,
            assigned_at: opts.assignedAt ?? null,
            picked_at: opts.pickedAt ?? null,
            delivered_at: opts.deliveredAt ?? null,
        })
        .returning("*")
        .then((rows: any[]) => new OrderEntity({...rows[0]}));
}
export async function seedOrderItem(
    conn: any,
    orderId: number,
    region: string,
    productId = 1,
    quantity = 2,
    unitPrice = 2500,
    name = "Burger",
): Promise<OrderItemEntity> {
    const rows = await conn("order_items")
        .insert({
            region,
            order_id: orderId,
            product_id: productId,
            quantity,
            unit_price_snapshot: unitPrice,
            name_snapshot: name,
            image_url_snapshot: null,
            line_total: unitPrice * quantity,
        })
        .returning("*");
    return new OrderItemEntity({...rows[0]});
}

export async function seedPaymentSession(
    conn: any,
    opts: {
        region: string;
        orderId: number;
        providerSessionId?: string;
        status?: PaymentSessionStatus;
        amount?: number;
        currency?: Currency;
    },
) {
    const rows = await conn("payment_sessions")
        .insert({
            region: opts.region,
            order_id: opts.orderId,
            provider_id: PAYMENT_PROVIDER_IDS[PaymentProviderName.KASHIER],
            provider_session_id: opts.providerSessionId ?? "session-1",
            redirect_url: "https://pay.example/x",
            amount: opts.amount ?? 6500,
            currency: opts.currency ?? Currency.EGP,
            status: opts.status ?? PaymentSessionStatus.INITIALIZED,
            raw_init_payload: JSON.stringify({}),
        })
        .returning("*");
    return rows[0];
}

export async function seedTransaction(
    conn: any,
    opts: {
        region: string;
        orderId: number | null;
        transactionType?: TransactionType;
        method?: TransactionMethod;
        status?: TransactionStatus;
        amount?: number;
        currency?: Currency;
        providerReferenceId?: string | null;
        idempotencyKey?: string | null;
        dstAccId?: number | null;
    },
) {
    const rows = await conn("transactions")
        .insert({
            region: opts.region,
            order_id: opts.orderId,
            transaction_type: opts.transactionType ?? TransactionType.CHARGE,
            method: opts.method ?? TransactionMethod.ONLINE,
            provider_id: PAYMENT_PROVIDER_IDS[PaymentProviderName.KASHIER],
            provider_reference_id: opts.providerReferenceId ?? null,
            status: opts.status ?? TransactionStatus.SUCCEEDED,
            amount: opts.amount ?? 6500,
            currency: opts.currency ?? Currency.EGP,
            src_acc_id: 1,
            dst_acc_id: opts.dstAccId ?? null,
            idempotency_key: opts.idempotencyKey ?? null,
        })
        .returning("*");
    return rows[0];
}

function cryptoUuid(): string {
    const {randomUUID} = require("crypto") as typeof import("crypto");
    return randomUUID();
}