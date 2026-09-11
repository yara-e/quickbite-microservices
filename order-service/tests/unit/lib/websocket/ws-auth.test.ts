import jwt from "jsonwebtoken";
import {authenticateHandshake, permittedChannels} from "@/lib/websocket/ws-auth";
import {WsNoTokenError} from "@/lib/websocket/errors";

describe("lib/websocket/ws-auth", () => {
    const validToken = jwt.sign(
        {userId: 3, role: "customer", email: "a@b.com"},
        "test-access-secret",
    );

    it("extracts token from handshake auth", () => {
        const user = authenticateHandshake({
            auth: {token: validToken},
            headers: {},
        });
        expect(user.userId).toBe(3);
    });

    it("extracts token from the access_token cookie", () => {
        const user = authenticateHandshake({
            auth: {},
            headers: {cookie: `access_token=${validToken}; other=x`},
        });
        expect(user.userId).toBe(3);
    });

    it("throws WsNoTokenError without a token", () => {
        expect(() =>
            authenticateHandshake({auth: {}, headers: {}}),
        ).toThrow(WsNoTokenError);
    });

    it("permittedChannels for a customer", () => {
        const allowed = permittedChannels({userId: 3, role: "customer", email: "a@b.com"});
        expect(allowed.has("customer:3")).toBe(true);
        expect(allowed.has("agent:3")).toBe(false);
    });

    it("permittedChannels for a restaurant user", () => {
        const allowed = permittedChannels({
            userId: 5,
            role: "restaurant_user",
            email: "r@b.com",
            restaurantId: 10,
            branchIds: [1, 2],
        });
        expect(allowed.has("restaurant:10")).toBe(true);
        expect(allowed.has("branch:1")).toBe(true);
        expect(allowed.has("branch:2")).toBe(true);
        expect(allowed.has("agent:5")).toBe(false);
    });

    it("permittedChannels for a delivery agent", () => {
        const allowed = permittedChannels({userId: 7, role: "delivery_agent", email: "d@b.com"});
        expect(allowed.has("agent:7")).toBe(true);
    });
});