import jwt from "jsonwebtoken";
import {env} from "../../src/lib/config/env";

export interface TestTokenPayload {
    userId?: number;
    role?: string;
    email?: string;
    restaurantId?: number;
    restaurantRole?: string;
    branchIds?: number[];
}

/** Sign an access token usable with the app's authenticate middleware. */
export function signAccessToken(payload: TestTokenPayload): string {
    return jwt.sign(
        {
            userId: payload.userId ?? 1,
            role: payload.role ?? "customer",
            email: payload.email ?? "user@test.com",
            ...(payload.restaurantId ? {restaurantId: payload.restaurantId} : {}),
            ...(payload.restaurantRole ? {restaurantRole: payload.restaurantRole} : {}),
            ...(payload.branchIds ? {branchIds: payload.branchIds} : {}),
        },
        env.jwt.accessSecret,
    );
}

export function customerToken(userId = 1): string {
    return signAccessToken({userId, role: "customer"});
}

export function agentToken(agentId = 7): string {
    return signAccessToken({userId: agentId, role: "delivery_agent"});
}

export function systemAdminToken(userId = 0): string {
    return signAccessToken({userId, role: "system_admin"});
}

export function restaurantOwnerToken(restaurantId: number, userId = 2): string {
    return signAccessToken({
        userId,
        role: "restaurant_user",
        restaurantId,
        restaurantRole: "owner",
        branchIds: [],
    });
}

export function restaurantStaffToken(
    restaurantId: number,
    branchIds: number[],
    userId = 3,
): string {
    return signAccessToken({
        userId,
        role: "restaurant_user",
        restaurantId,
        restaurantRole: "staff",
        branchIds,
    });
}