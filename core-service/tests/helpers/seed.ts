import { db } from "../../src/lib/knex/knex";
import { hashPassword, createAccessToken } from "../../src/app/auth/utils";
import { SystemRole } from "../../src/app/user/enums";
import { RestaurantStatus } from "../../src/app/restaurant/enums";
import { Currency } from "../../src/app/branch/enums";
import { MemberStatus } from "../../src/app/rbac/enums";
import { User } from "../../src/app/user/entity/user.entity";
import { RestaurantEntity } from "../../src/app/restaurant/entity/restaurant.entity";
import { Branch } from "../../src/app/branch/entity/branch.entity";

export interface SeededUser {
    user: User;
    accessToken: string;
    refreshToken: string;
}

export const TEST_PASSWORD = "Str0ng!Pass";

export async function createUser(
    overrides: Partial<{
        email: string;
        phone: string;
        name: string;
        systemRole: SystemRole;
        password: string;
    }> = {}
): Promise<SeededUser> {
    const email = overrides.email ?? `user-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.com`;
    const now = new Date();
    const [row] = await db("users")
        .insert({
            email,
            phone: overrides.phone ?? randomPhone(),
            name: overrides.name ?? "Test User",
            password_hash: await hashPassword(overrides.password ?? TEST_PASSWORD),
            system_role: overrides.systemRole ?? SystemRole.CUSTOMER,
            created_at: now,
            updated_at: now,
        })
        .returning("*");

    const user = new User({
        id: row.id,
        email: row.email,
        phone: row.phone,
        name: row.name,
        passwordHash: row.password_hash,
        systemRole: row.system_role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
    });
    const accessToken = createAccessToken({
        userId: user.id,
        email: user.email,
        role: user.systemRole,
    });
    const refreshToken = createAccessToken({ userId: user.id, email: user.email, role: user.systemRole });

    return { user, accessToken, refreshToken };
}

export function randomPhone(): string {
    return `01${String(Math.floor(100000000 + Math.random() * 899999999))}`;
}
export async function createRestaurant(
    ownerId: number,
    overrides: Partial<RestaurantEntity> = {}
): Promise<RestaurantEntity> {
    const now = new Date();
    const [row] = await db("restaurants")
        .insert({
            owner_id: ownerId,
            name: overrides.name ?? "Test Restaurant",
            logo_url: overrides.logoURL ?? "",
            status: overrides.status ?? RestaurantStatus.ACTIVE,
            primary_country: overrides.primaryCountry ?? "EG",
            created_at: now,
            updated_at: now,
            status_updated_at: now,
        })
        .returning("*");
    return new RestaurantEntity({
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        logoURL: row.logo_url,
        status: row.status,
        primaryCountry: row.primary_country,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        statusUpdatedAt: row.status_updated_at,
    });
}

export async function createBranch(
    restaurantId: number,
    overrides: Partial<Branch> = {}
): Promise<Branch> {
    const now = new Date();
    const [row] = await db("restaurant_branches")
        .insert({
            restaurant_id: restaurantId,
            country_code: overrides.countryCode ?? "EG",
            address_text: overrides.addressText ?? "1 Test Street",
            label: overrides.label ?? "Downtown Branch",
            lat: overrides.lat ?? 30.0444,
            lng: overrides.lng ?? 31.2357,
            is_active: overrides.isActive ?? true,
            opens_at: overrides.opensAt ?? "09:00:00",
            closes_at: overrides.closesAt ?? "23:00:00",
            accept_orders: overrides.acceptOrders ?? true,
            created_at: now,
            updated_at: now,
            delivery_radius: overrides.deliveryRadius ?? 5,
            delivery_fee: overrides.deliveryFee ?? 15,
            currency: overrides.currency ?? Currency.EGP,
            commission: overrides.commission ?? 0,
        })
        .returning("*");

    return new Branch({
        id: row.id,
        restaurantId: row.restaurant_id,
        countryCode: row.country_code,
        addressText: row.address_text,
        label: row.label,
        lat: Number(row.lat),
        lng: Number(row.lng),
        isActive: row.is_active,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        acceptOrders: row.accept_orders,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deliveryRadius: row.delivery_radius,
        deliveryFee: row.delivery_fee,
        currency: row.currency,
        commission: row.commission,
    });
}

/** Creates an owner restaurant user who owns the given restaurant (plus the RBAC owner member row). */
export async function createRestaurantOwner(restaurantOverrides: Partial<RestaurantEntity> = {}) {
    const { user } = await createUser({
        systemRole: SystemRole.RESTAURANT_USER,
        name: "Restaurant Owner",
    });
    const restaurant = await createRestaurant(user.id, restaurantOverrides);
    const ownerRoleId = await db("roles").where("name", "owner").select("id").first();
    const now = new Date();
    const [member] = await db("restaurant_members")
        .insert({
            restaurant_id: restaurant.id,
            user_id: user.id,
            role_id: ownerRoleId.id,
            status: MemberStatus.ACTIVE,
            created_at: now,
            updated_at: now,
        })
        .returning("*");

    const accessToken = createAccessToken({
        userId: user.id,
        email: user.email,
        role: user.systemRole,
        restaurantId: restaurant.id,
        restaurantRole: "owner",
        branchIds: [],
    });
    const refreshToken = createAccessToken({ userId: user.id, email: user.email, role: user.systemRole });

    return { user, restaurant, member, accessToken, refreshToken };
}

/** Creates a non-owner restaurant member (staff / branch_manager) with optional branch assignments. */
export async function createRestaurantMemberUser(
    restaurantId: number,
    role: string,
    branchIds: number[] = []
) {
    const { user } = await createUser({
        systemRole: SystemRole.RESTAURANT_USER,
        name: role === "staff" ? "Staff User" : "Branch Manager",
    });
    const roleRow = await db("roles").where("name", role).select("id").first();
    const now = new Date();
    const [member] = await db("restaurant_members")
        .insert({
            restaurant_id: restaurantId,
            user_id: user.id,
            role_id: roleRow.id,
            status: MemberStatus.ACTIVE,
            created_at: now,
            updated_at: now,
        })
        .returning("*");

    if (branchIds.length > 0) {
        await db("member_branches").insert(
            branchIds.map((branchId) => ({ member_id: member.id, branch_id: branchId, created_at: now }))
        );
    }

    const accessToken = createAccessToken({
        userId: user.id,
        email: user.email,
        role: user.systemRole,
        restaurantId,
        restaurantRole: role,
        branchIds,
    });

    return { user, member, accessToken };
}

/** Creates a product. The DB trigger auto-inserts product_branch_details rows. */
export async function createProduct(restaurantId: number, name = "Burger", categoryId: number | null = null) {
    const now = new Date();
    const [row] = await db("products")
        .insert({
            name,
            description: "Delicious",
            image_url: "",
            restaurant_id: restaurantId,
            category_id: categoryId,
            created_at: now,
            updated_at: now,
        })
        .returning("*");
    return row;
}