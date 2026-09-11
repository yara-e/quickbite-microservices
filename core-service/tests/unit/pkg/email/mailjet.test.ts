import { MailjetEmailProvider } from "../../../../src/pkg/email/mailjet";

jest.mock("node-mailjet", () => {
    const requestMock = jest.fn().mockResolvedValue({ ok: true });
    return jest.fn().mockImplementation(() => ({
        post: jest.fn().mockReturnThis(),
        request: requestMock,
    }));
});

import Mailjet from "node-mailjet";

const MailjetMock = Mailjet as unknown as jest.Mock;

describe("MailjetEmailProvider", () => {
    const config = {
        apiKey: "key",
        secretKey: "secret",
        fromEmail: "no-reply@test.com",
        fromName: "QuickBite",
    };

    it("constructs the client with api credentials", () => {
        new MailjetEmailProvider(config);
        expect(MailjetMock).toHaveBeenCalledWith({ apiKey: "key", apiSecret: "secret" });
    });

    it("sends a v3.1 message through the post/request pipeline", async () => {
        const provider = new MailjetEmailProvider(config);
        await provider.send("to@test.com", "Subject", "<p>html</p>");

        const client = MailjetMock.mock.results[1].value;
        expect(client.post).toHaveBeenCalledWith("send", { version: "v3.1" });
        expect(client.request).toHaveBeenCalledWith({
            Messages: [
                {
                    From: { Email: "no-reply@test.com", Name: "QuickBite" },
                    To: [{ Email: "to@test.com" }],
                    Subject: "Subject",
                    HTMLPart: "<p>html</p>",
                },
            ],
        });
    });
});