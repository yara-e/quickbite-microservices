import {Knex} from "knex";
import {injectable, inject} from "tsyringe";
import {TOKENS} from "../../../lib/di/tokens";
import {PaginationParams, FilterParams, buildPaginationResult} from "../../../lib/http/pagination/cursor-pagination";
import {db} from "../../../lib/knex/knex";
import {UnAuthorisedError} from "../../../lib/auth/errors";
import {RestaurantNotFoundError} from "../errors";
import {RegisterRestaurantDTO} from "../../auth/dto/auth.dto";
import {SystemRole} from "../../user/enums";
import {UserService} from "../../user/service/user.service";
import {RestaurantEntity} from "../entity/restaurant.entity";
import {CreateRestaurantDTO, UpdateRestaurantDTO, UpdateRestaurantStatusDTO} from "../dto/restaurant.dto";
import {RestaurantStatus} from "../enums";
import {insertOutboxEvent} from "../../../lib/events/outbox.repo";
import {EVENT_TYPES} from "../../../lib/events/event-types";
import {createRestaurant, findAllRestaurants, findRestaurantById, updateRestaurant, updateRestaurantStatus} from "../repository/restaurant.repo";


@injectable()
export class RestaurantService {
    constructor(@inject(TOKENS.UserService) private readonly userService: UserService) {}

    createWithOwner = async (userRole: SystemRole, data: CreateRestaurantDTO) => {
        if (userRole !== SystemRole.SYSTEM_ADMIN) {
            throw UnAuthorisedError;
        }

        const now = new Date();
        const trx = await db.transaction();

        try {
            const user = await this.userService.create({
                email: data.owner.email,
                phone: data.owner.phone,
                name: data.owner.name,
                password: data.owner.password,
                systemRole: SystemRole.RESTAURANT_USER,
            }, trx);

            const restaurant = await createRestaurant(new RestaurantEntity({
                ownerId: user.id,
                name: data.name,
                logoURL: data.logoUrl ?? "",
                primaryCountry: data.primaryCountry,
                status: RestaurantStatus.ACTIVE,
                createdAt: now,
                updatedAt: now,
                statusUpdatedAt: now,
            }), trx);

            // resolve from container to avoid circular dependency
            const {container: c} = require("../../../lib/di/container");
            const {TOKENS: T} = require("../../../lib/di/tokens");
            const memberSvc = c.resolve(T.MemberService);
            await memberSvc.createOwnerMember(restaurant.id, user.id, trx);

            await trx.commit();

            return {
                restaurant,
                owner: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    name: user.name,
                    systemRole: user.systemRole,
                },
            };
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    create = async (userId: number, data: RegisterRestaurantDTO, trx: Knex)=> {
        const now = new Date();
        const restaurant = new RestaurantEntity({
            ownerId: userId,
            name: data.name,
            logoURL: data.logoURL,
            primaryCountry: data.primaryCountry,
            status: RestaurantStatus.PENDING,
            createdAt: now,
            updatedAt: now,
            statusUpdatedAt: now
        })
        const result = await createRestaurant(restaurant, trx);

        return result;
    }

    findAll = async(params: PaginationParams, filters: FilterParams[]) => {
        const result = await findAllRestaurants(params, filters);
        return buildPaginationResult(result, params.limit, params.sortBy);
    }

    findById = async(id: number) => {
        const restaurant = await findRestaurantById(id);
        if (!restaurant) {
            throw RestaurantNotFoundError;
        }
        return restaurant;
    }

    update = async(id: number, userId: number, userRole: SystemRole, data: UpdateRestaurantDTO) => {
        const restaurant = await findRestaurantById(id);
        if (!restaurant) {
            throw RestaurantNotFoundError;
        }
        if (userRole !== SystemRole.SYSTEM_ADMIN && Number(restaurant.ownerId) !== Number(userId)) {
            throw UnAuthorisedError;
        }
        return await updateRestaurant(id, data);
    }

    updateStatus = async(id: number, userRole: SystemRole, data: UpdateRestaurantStatusDTO) => {
        if (userRole !== SystemRole.SYSTEM_ADMIN) {
            throw UnAuthorisedError;
        }
        const restaurant = await findRestaurantById(id);
        if (!restaurant) {
            throw RestaurantNotFoundError;
        }
        const trx = await db.transaction();
        try {
            const updated = await updateRestaurantStatus(id, data.status, trx);
            if (data.status === "suspended") {
                await insertOutboxEvent(trx, {
                    aggregateType: "restaurants",
                    aggregateId: id,
                    eventType: EVENT_TYPES.RESTAURANT_SUSPENDED,
                    payload: {restaurantId: id},
                });
            }
            await trx.commit();
            return updated;
        } catch (err) {
            await trx.rollback();
            throw err;
        }
    }
}
