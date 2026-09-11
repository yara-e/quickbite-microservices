import {injectable} from "tsyringe";
import {UnAuthorisedError} from "../../../lib/auth/errors";
import {RestaurantNotFoundError} from "../../restaurant/errors";
import {findRestaurantById, findRestaurantsByIds} from "../../restaurant/repository/restaurant.repo";
import {BranchNotFoundError} from "../errors";
import {SystemRole} from "../../user/enums";
import {db} from "../../../lib/knex/knex";
import {insertOutboxEvent} from "../../../lib/events/outbox.repo";
import {EVENT_TYPES} from "../../../lib/events/event-types";
import {cacheProvider} from "../../../lib/cache/init";
import {CreateBranchDTO, UpdateBranchDTO, UpdateBranchStatusDTO} from "../dto/branch.dto";
import {BranchWithRestaurant} from "../types";
import {findNearbyBranches, createBranch, findBranchesByRestaurant, findBranchById, findBranchesByIds, updateBranch, updateBranchStatus} from "../repository/branch.repo";

@injectable()
export class BranchService {

    findNearby = async (lat:number, lng:number) => {
        const rows = await findNearbyBranches(lat, lng);
        return rows;
    }

    findByRestaurant = async (restaurantId: number) => {
        return await findBranchesByRestaurant(restaurantId);
    }

    findByIdWithRestaurant = async (branchId: number): Promise<BranchWithRestaurant | null> => {
        const branch = await findBranchById(branchId);
        if (!branch) return null;
        const restaurant = await findRestaurantById(branch.restaurantId);
        if (!restaurant) return null;
        return {
            branch,
            restaurantStatus: restaurant.status,
            restaurantOwnerId: Number(restaurant.ownerId),
        };
    }

    /**
     * Batch variant of findByIdWithRestaurant. Two queries total — one
     * `WHERE branch.id IN (...)`, one `WHERE restaurant.id IN (...)` — then
     * joined in-memory. Keeps the order-service's `getBranchesByIds` cheap.
     * Branches whose restaurant is missing are dropped (same null behaviour
     * as the single variant).
     */
    findByIdsWithRestaurant = async (branchIds: number[]): Promise<BranchWithRestaurant[]> => {
        if (branchIds.length === 0) return [];
        const branches = await findBranchesByIds(branchIds);
        if (branches.length === 0) return [];
        const restaurants = await findRestaurantsByIds(Array.from(new Set(branches.map((b) => b.restaurantId))));
        const byId = new Map(restaurants.map((r) => [Number(r.id), r]));
        const out: BranchWithRestaurant[] = [];
        for (const branch of branches) {
            const restaurant = byId.get(Number(branch.restaurantId));
            if (!restaurant) continue;
            out.push({
                branch,
                restaurantStatus: restaurant.status,
                restaurantOwnerId: Number(restaurant.ownerId),
            });
        }
        return out;
    }

    create = async (restaurantId: number, userId: number, userRole: SystemRole, data: CreateBranchDTO) => {
        const restaurant = await findRestaurantById(restaurantId);
        if (!restaurant) throw RestaurantNotFoundError;

        if(userRole != SystemRole.SYSTEM_ADMIN && (Number(restaurant.ownerId) !== Number(userId)) ){
            throw UnAuthorisedError
        }

        const now = new Date();
        const branch = await createBranch({
            restaurantId: restaurantId,
            label: data.label,
            countryCode: data.countryCode,
            lat: data.lat,
            lng: data.lng,
            addressText: data.addressText,
            isActive: false,
            opensAt: data.opensAt,
            closesAt: data.closesAt,
            currency: data.currency,
            deliveryRadius: data.deliveryRadius,
            commission: 0,
            createdAt: now,
            updatedAt: now,
            acceptOrders: true,
        });

        return branch;
    }

    update = async (branchId: number, userId: number, userRole: SystemRole, data: UpdateBranchDTO) => {
        const branch = await findBranchById(branchId);
        if (!branch) {
            throw BranchNotFoundError;
        }

        const restaurant = await findRestaurantById(branch.restaurantId);
        if (!restaurant) throw RestaurantNotFoundError;
        if (userRole !== SystemRole.SYSTEM_ADMIN && Number(restaurant.ownerId) !== Number(userId)) {
            throw UnAuthorisedError;
        }

        const trx = await db.transaction();
        try {
            const updated = await updateBranch(branchId, data, trx);
            await insertOutboxEvent(trx, {
                aggregateType: "restaurant_branches",
                aggregateId: branchId,
                eventType: EVENT_TYPES.BRANCH_UPDATED,
                payload: {branchId},
            });
            await trx.commit();
            await cacheProvider.del(`GET:/api/internal/branches/${branchId}`);
            return updated;
        } catch (err) {
            await trx.rollback();
            throw err;
        }
    }

    updateStatus = async (branchId: number, userRole: SystemRole, data: UpdateBranchStatusDTO) => {
        if (userRole !== SystemRole.SYSTEM_ADMIN) {
            throw UnAuthorisedError;
        }

        const branch = await findBranchById(branchId);
        if (!branch) {
            throw BranchNotFoundError;
        }

        const trx = await db.transaction();
        try {
            const updated = await updateBranchStatus(branchId, data, trx);
            const eventType = data.isActive === false
                ? EVENT_TYPES.BRANCH_DEACTIVATED
                : EVENT_TYPES.BRANCH_UPDATED;
            await insertOutboxEvent(trx, {
                aggregateType: "restaurant_branches",
                aggregateId: branchId,
                eventType,
                payload: {branchId},
            });
            await trx.commit();
            await cacheProvider.del(`GET:/api/internal/branches/${branchId}`);
            return updated;
        } catch (err) {
            await trx.rollback();
            throw err;
        }
    }
}
