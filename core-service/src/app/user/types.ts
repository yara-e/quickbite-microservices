import {SystemRole} from "./enums";

export interface CreateUserData {
    email: string;
    phone: string;
    name: string;
    password: string;
    systemRole: SystemRole;
}
