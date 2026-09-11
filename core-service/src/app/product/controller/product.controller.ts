import {Request, Response, NextFunction} from "express";
import {injectable, inject} from "tsyringe";
import {TOKENS} from "../../../lib/di/tokens";
import {sendSuccess} from "../../../lib/http/response";
import {validateBody} from "../../../lib/validation/validate";
import {SystemRole} from "../../user/enums";
import {CreateProductDTO, UpdateProductDTO} from "../dto/product.dto";
import {ProductService} from "../service/product.service";
import {InvalidReserveItemsError, MissingProductIdsQueryError} from "../errors";

@injectable()
export class ProductController {
    constructor(@inject(TOKENS.ProductService) private readonly productService: ProductService) {}

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(CreateProductDTO, req.body);
            const product = await this.productService.create(
                Number(req.params.restaurantId),
                req.user?.userId!,
                req.user?.role! as SystemRole,
                data,
            );
            sendSuccess(res, {message: "Product created", product}, 201);
        } catch (err) {
            next(err);
        }
    }

    findByRestaurant = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const results = await this.productService.findByRestaurant(
                Number(req.params.restaurantId),
                req.user?.userId!,
                req.user?.role! as SystemRole,
            );
            sendSuccess(res, results);
        } catch (err) {
            next(err);
        }
    }

    findCategories = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const results = await this.productService.findCategories(Number(req.params.restaurantId));
            sendSuccess(res, results);
        } catch (err) {
            next(err);
        }
    }

    findByBranch = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const results = await this.productService.findByBranch(Number(req.params.branchId));
            sendSuccess(res, results);
        } catch (err) {
            next(err);
        }
    }

    findById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const product = await this.productService.findById(Number(req.params.id));
            sendSuccess(res, product);
        } catch (err) {
            next(err);
        }
    }

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await validateBody(UpdateProductDTO, req.body);
            const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
            const result = await this.productService.update(
                Number(req.params.id),
                req.user?.userId!,
                req.user?.role! as SystemRole,
                data,
                branchId,
            );
            sendSuccess(res, {message: "Product updated", ...result});
        } catch (err) {
            next(err);
        }
    }

    findByBranchAndIds = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const branchId = Number(req.params.id);
            const raw = typeof req.query.ids === "string" ? req.query.ids : "";
            const ids = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
            if (ids.length === 0) throw MissingProductIdsQueryError;
            const products = await this.productService.findByBranchAndIds(branchId, ids);
            sendSuccess(res, products);
        } catch (err) {
            next(err);
        }
    }

    reserveStock = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const branchId = Number(req.params.id);
            const items = req.body?.items;
            if (!Array.isArray(items) || items.length === 0) {
                throw InvalidReserveItemsError;
            }
            const result = await this.productService.reserveStock(branchId, items);
            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    }

    releaseStock = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const branchId = Number(req.params.id);
            const items = req.body?.items;
            if (!Array.isArray(items) || items.length === 0) {
                throw InvalidReserveItemsError;
            }
            const result = await this.productService.releaseStock(branchId, items);
            sendSuccess(res, result);
        } catch (err) {
            next(err);
        }
    }
}
