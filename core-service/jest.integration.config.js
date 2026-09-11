module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/tests/integration", "<rootDir>/src"],
    testMatch: ["**/*integration.test.ts"],
    setupFiles: ["<rootDir>/tests/setup-env.ts"],
    globalSetup: "<rootDir>/tests/integration/globalSetup.ts",
    globalTeardown: "<rootDir>/tests/integration/teardown.ts",
    maxWorkers: 1,
    forceExit: true,
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", {tsconfig: "tsconfig.test.json"}],
    },
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/server.ts",
        "!src/worker.ts",
        "!src/migrations/**",
        "!src/**/*.d.ts",
    ],
    coverageDirectory: "<rootDir>/coverage/integration",
    coverageReporters: ["text", "json", "lcov", "json-summary"],
    testTimeout: 30000,
};