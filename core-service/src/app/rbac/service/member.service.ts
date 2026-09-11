import {Knex} from "knex";
import {injectable, inject} from "tsyringe";
import {TOKENS} from "../../../lib/di/tokens";
import type {IEmailProvider} from "../../../pkg/email/email.interface";
import {db} from "../../../lib/knex/knex";
import {toMs} from "../../../pkg/utils/time";
import {createPasswordReset} from "../../auth/repository/password-reset.repo";
import {generateOTP, hashOTP} from "../../auth/utils";
import {SystemRole} from "../../user/enums";
import {UserService} from "../../user/service/user.service";
import {CreateMemberDTO, UpdateMemberDTO, UpdateMemberBranchesDTO} from "../dto/member.dto";
import {memberInvitationEmail} from "../templates/member-invitation";
import {MemberBranch} from "../entity/member-branch.entity";
import {RestaurantMember} from "../entity/restaurant-member.entity";
import {MemberStatus} from "../enums";
import {
    CannotCreateOwnerUserError,
    RoleNotFoundError,
    MemberNotFoundError,
    CannotDeleteOwnerError,
    InvalidBranchIdsError,
    CannotAssignBranchesToOwnerError
} from "../errors";
import {setMemberBranches, countBranchesByIdsAndRestaurant} from "../repository/member-branch.repo";
import {createRestaurantMember, findMembersByRestaurantId, findMemberWithRoleName, updateMember, deleteMember} from "../repository/restaurant_member.repo";
import {findRoleByName} from "../repository/role.repo";
import {getPermissionsDetailsByRoleName, getPermissionsByRoleName} from "../repository/permission.repo";



@injectable()
export class MemberService{
    constructor(
        @inject(TOKENS.UserService) private readonly userService: UserService,
        @inject(TOKENS.EmailProvider) private readonly emailProvider: IEmailProvider,
    ) {}

    async createOwnerMember(restaurantId: number, userId: number, trx?: Knex.Transaction): Promise<RestaurantMember> {
        const ownerRoleId = await findRoleByName('owner', trx);
        if (!ownerRoleId) throw RoleNotFoundError;
        const now = new Date();
        return createRestaurantMember({
            restaurantId,
            userId,
            roleId: ownerRoleId,
            status: MemberStatus.ACTIVE,
            createdAt: now,
            updatedAt: now,
        }, trx);
    }

    async createMember(restaurantId: number, data: CreateMemberDTO){
        // dont accept owner role creation
        if(data.role == 'owner') {
            throw CannotCreateOwnerUserError
        }

        // find roleId by role name
        const roleId = await findRoleByName(data.role);
        if(!roleId){
            throw RoleNotFoundError
        }

        // validate branchIds belong to this restaurant
        const branchIds = data.branchIds || [];
        await this.validateBranchOwnership(branchIds, restaurantId);

        // create user, member, assign branches
        const trx = await db.transaction();
        try {
            const now = new Date();
            const user = await this.userService.create({
                email: data.email,
                phone: data.phoneNumber,
                name: data.name,
                password: '',
                systemRole: SystemRole.RESTAURANT_USER,
            }, trx);

            const member = await createRestaurantMember(
                {
                    restaurantId,
                    userId: user.id,
                    roleId,
                    createdAt: now,
                    updatedAt: now,
                    status: MemberStatus.INACTIVE
                }, trx
            )
            // assign branches
            const rows = branchIds.map(branchId => new MemberBranch({
                branchId: branchId,
                memberId: member.id,
                createdAt: now,
            }))
            await setMemberBranches(member.id, rows, trx)

            // generate otp, create password reset record and send email
            const otp = generateOTP();
            const hashedOtp = hashOTP(otp);
            await createPasswordReset({
                    userId: user.id,
                    otpHash: hashedOtp,
                    expiresAt: new Date(Date.now() + toMs(7, 'd')),
                    createdAt: new Date(),
                }, trx
            )
            const email = memberInvitationEmail(otp, data.role);
            await this.emailProvider.send(data.email, email.subject, email.html);

            await trx.commit()

            return {
                message: "Member invited successfully",
                member: {
                    id: member.id,
                    userId: user.id,
                    email: data.email,
                    name: data.name,
                    phone: data.phoneNumber,
                    role: data.role,
                    status: MemberStatus.INACTIVE,
                    branchIds,
                }
            }
        }
        catch (err) {
            await trx.rollback();
            throw err;
        }
    }

    async listMembers(restaurantId: number) {
        const members = await findMembersByRestaurantId(restaurantId);
        return {data: members};
    }

    async updateMember(restaurantId: number, memberId: number, data: UpdateMemberDTO) {
        // single query: member + role name
        const result = await findMemberWithRoleName(memberId);
        if (!result || Number(result.member.restaurantId) !== Number(restaurantId)) {
            throw MemberNotFoundError;
        }

        const updateData: {roleId?: number, status?: string} = {};
        if (data.role) {
            const roleId = await findRoleByName(data.role);
            if (!roleId) throw RoleNotFoundError;
            updateData.roleId = roleId;
        }
        if (data.status) {
            updateData.status = data.status;
        }

        await updateMember(memberId, updateData);
        return {message: "Member updated successfully"};
    }

    async deleteMember(restaurantId: number, memberId: number) {
        // single query: member + role name (no N+1)
        const result = await findMemberWithRoleName(memberId);
        if (!result || Number(result.member.restaurantId) !== Number(restaurantId)) {
            throw MemberNotFoundError;
        }
        if (result.roleName === 'owner') {
            throw CannotDeleteOwnerError;
        }
        await deleteMember(memberId);
        return {message: "Member deleted successfully"};
    }

    async updateMemberBranches(restaurantId: number, memberId: number, data: UpdateMemberBranchesDTO) {
        // single query: member + role name (no N+1)
        const result = await findMemberWithRoleName(memberId);
        if (!result || Number(result.member.restaurantId) !== Number(restaurantId)) {
            throw MemberNotFoundError;
        }
        if (result.roleName === 'owner') {
            throw CannotAssignBranchesToOwnerError;
        }

        // validate branchIds belong to this restaurant (single COUNT query)
        await this.validateBranchOwnership(data.branchIds, restaurantId);

        const now = new Date();
        const rows = data.branchIds.map(branchId => new MemberBranch({
            branchId,
            memberId: result.member.id,
            createdAt: now,
        }));
        await setMemberBranches(memberId, rows);

        return {
            message: "Member branch assignments updated successfully",
            branchIds: data.branchIds,
        };
    }

    async getRolePermissions(roleName: string) {
        const permissions = await getPermissionsDetailsByRoleName(roleName);
        return {role: roleName, permissions};
    }

    async getPermissionsByRole(roleName: string) {
        const permissions = await getPermissionsByRoleName(roleName);
        return {role: roleName, permissions};
    }

    async validateBranchOwnership(branchIds: number[], restaurantId: number) {
        if (branchIds.length === 0) return;
        const count = await countBranchesByIdsAndRestaurant(branchIds, restaurantId);
        if (count !== branchIds.length) {
            throw InvalidBranchIdsError;
        }
    }
}
