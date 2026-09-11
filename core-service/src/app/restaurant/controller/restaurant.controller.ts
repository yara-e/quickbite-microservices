import {NextFunction, Request, Response} from "express";
import {injectable, inject} from "tsyringe";
import {TOKENS} from "../../../lib/di/tokens";
import {parsePaginationQuery, parseFilters} from "../../../lib/http/pagination/parse-query";
import {sendSuccess, sendPaginated} from "../../../lib/http/response";
import {validateBody} from "../../../lib/validation/validate";
import {SystemRole} from "../../user/enums";
import {CreateRestaurantDTO, UpdateRestaurantDTO, UpdateRestaurantStatusDTO} from "../dto/restaurant.dto";
import {RestaurantService} from "../service/restaurant.service";

@injectable()
export class RestaurantController {
    constructor(@inject(TOKENS.RestaurantService) private readonly restaurantService: RestaurantService) {}

    create = async(req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(CreateRestaurantDTO, req.body);
            const result = await this.restaurantService.createWithOwner(req.user?.role! as SystemRole, data);
            sendSuccess(res, result, 201);
        } catch (err) {
            next(err);
        }
    }

    getAll = async(req: Request, res: Response, next: NextFunction) => {
        try {
            const params = parsePaginationQuery(req.query, ['createdAt', 'name', 'status']);
            const filters = parseFilters(req.query,['id','status','name']);
            const result = await this.restaurantService.findAll(params, filters);
            sendPaginated(res, result.data, result.meta);
        } catch (err) {
            next(err);
        }
    }

    getById = async(req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.restaurantService.findById(Number(req.params.id));
            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    }

    update = async(req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(UpdateRestaurantDTO, req.body);
            const result = await this.restaurantService.update(Number(req.params.id), req.user?.userId!, req.user?.role! as SystemRole, data);
            sendSuccess(res, {message: "Restaurant updated", restaurant: result});
        } catch (err) {
            next(err);
        }
    }

    updateStatus = async(req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(UpdateRestaurantStatusDTO, req.body);
            const result = await this.restaurantService.updateStatus(Number(req.params.id), req.user?.role! as SystemRole, data);
            sendSuccess(res, {message: "Status updated", restaurant: {id: result.id, status: result.status}});
        } catch (err) {
            next(err);
        }
    }
}
