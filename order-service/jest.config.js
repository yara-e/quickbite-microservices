module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/tests/unit"],
    testMatch: ["**/*.test.ts"],
    setupFiles: ["<rootDir>/tests/setup-env.ts"],
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
    coverageDirectory: "<rootDir>/coverage/unit",
    coverageReporters: ["text", "json", "lcov", "json-summary"],
    maxWorkers: 1,
    testTimeout: 15000,
};