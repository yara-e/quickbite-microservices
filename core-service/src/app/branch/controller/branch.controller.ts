import {Request, Response, NextFunction} from "express";
import {injectable, inject} from "tsyringe";
import {TOKENS} from "../../../lib/di/tokens";
import {sendSuccess} from "../../../lib/http/response";
import {validateBody} from "../../../lib/validation/validate";
import {SystemRole} from "../../user/enums";
import {CreateBranchDTO, UpdateBranchDTO, UpdateBranchStatusDTO} from "../dto/branch.dto";
import {BranchService} from "../service/branch.service";
import {BranchNotFoundError} from "../errors";

@injectable()
export class BranchController {
    constructor(@inject(TOKENS.BranchService) private readonly branchService: BranchService) {
    }

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(CreateBranchDTO, req.body);
            const branch = await this.branchService.create(Number(req.params.restaurantId), req.user?.userId!, req.user?.role! as SystemRole, data);
            sendSuccess(res, {message: "Branch created", branch}, 201);
        } catch (err) {
            next(err);
        }
    }

    findNearby = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const results = await this.branchService.findNearby( Number(req.query.lat), Number(req.query.lng))
            sendSuccess(res, results);
        } catch (err) {
            next(err);
        }
    }

    findByRestaurant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const results = await this.branchService.findByRestaurant(Number(req.params.restaurantId));
            sendSuccess(res, results);
        } catch (err) {
            next(err);
        }
    }

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(UpdateBranchDTO, req.body);
            const branch = await this.branchService.update(Number(req.params.id), req.user?.userId!, req.user?.role! as SystemRole, data);
            sendSuccess(res, {message: "Branch updated", branch});
        } catch (err) {
            next(err);
        }
    }

    updateStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(UpdateBranchStatusDTO, req.body);
            const branch = await this.branchService.updateStatus(Number(req.params.id), req.user?.role! as SystemRole, data);
            sendSuccess(res, {message: "Branch status updated", branch: {id: branch.id, isActive: branch.isActive, acceptOrders: branch.acceptOrders, commission: branch.commission}});
        } catch (err) {
            next(err);
        }
    }

    findByIdWithRestaurant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = Number(req.params.id);
            const result = await this.branchService.findByIdWithRestaurant(id);
            if (!result) throw BranchNotFoundError;
            sendSuccess(res, toInternalBranchDTO(result));
        } catch (err) {
            next(err);
        }
    }

    /**
     * Batch lookup for the order-service's `getBranchesByIds`. Caller passes
     * `?ids=1,2,3` (max 100 per call to keep the URL bounded). Missing ids
     * are silently dropped from the response — clients should not assume
     * `response.length === input.length`.
     */
    findByIdsWithRestaurant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const raw = String(req.query.ids ?? "").trim();
            if (!raw) return sendSuccess(res, []);
            const ids = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
            if (ids.length === 0) return sendSuccess(res, []);
            if (ids.length > 100) return res.status(400).json({error: "ids: max 100 per call"});
            const results = await this.branchService.findByIdsWithRestaurant(ids);
            sendSuccess(res, results.map(toInternalBranchDTO));
        } catch (err) {
            next(err);
        }
    }
}

function toInternalBranchDTO(r: {branch: any; restaurantStatus: string; restaurantOwnerId: number}) {
    const {branch, restaurantStatus, restaurantOwnerId} = r;
    return {
        id: branch.id,
        restaurantId: branch.restaurantId,
        restaurantOwnerId,
        restaurantStatus,
        region: branch.countryCode,
        isActive: branch.isActive,
        acceptOrders: branch.acceptOrders,
        deliveryFee: branch.deliveryFee,
        // restaurant_branches.commission is stored as a 0-100 percent (the
        // UpdateBranchStatusDTO caps it at 100). Convert to basis points here
        // so consumers can use the standard bps math (× / 10000).
        commissionBps: branch.commission * 100,
        currency: branch.currency,
        lat: Number(branch.lat),
        lng: Number(branch.lng),
        name: branch.label,
        addressText: branch.addressText,
    };
}
