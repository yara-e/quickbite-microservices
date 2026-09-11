import {Knex} from "knex";
import {injectable} from "tsyringe";
import {SystemRole} from "../enums";
import {UserNotFoundError} from "../errors";
import {UserAlreadyExistsError} from "../../auth/errors";
import {hashPassword} from "../../auth/utils";
import {findUserById, findUserExistsByEmailOrPhone, createUser as createUserRepo, updateUser} from "../repository/users.repo";
import {UpdateUserDTO} from "../dto/user.dto";
import {User} from "../entity/user.entity";
import {CreateUserData} from "../types";

 

@injectable()
export class UserService {
    create = async (data: CreateUserData, trx?: Knex | Knex.Transaction): Promise<User> => {
        const existing = await findUserExistsByEmailOrPhone(data.email, data.phone);
        if (existing) {
            throw UserAlreadyExistsError;
        }
        const hashedPassword = data.password ? await hashPassword(data.password) : '';
        const now = new Date();
        return createUserRepo({
            email: data.email,
            phone: data.phone,
            name: data.name,
            passwordHash: hashedPassword,
            systemRole: data.systemRole,
            createdAt: now,
            updatedAt: now,
        }, trx);
    }

    getByUserId = async (userId:number) => {
        const user = await findUserById(userId);
        if(!user) {
            throw UserNotFoundError
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            systemRole: user.systemRole,
        }
    }

    updateProfile = async (userId: number, data: UpdateUserDTO) => {
        const user = await findUserById(userId);
        if (!user) {
            throw UserNotFoundError;
        }
        const updated = await updateUser(userId, data);
        return {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            phone: updated.phone,
            systemRole: updated.systemRole,
        };
    }

 getAgentById = async (id: number) => {
        const user = await findUserById(id);
        if (!user) throw UserNotFoundError;
        if (user.systemRole !== SystemRole.DELIVERY_AGENT) {
            // Use UserNotFoundError to avoid enumeration of other user types.
            throw UserNotFoundError;
        }
        return {id: user.id, name: user.name, phone: user.phone};
    }

}
