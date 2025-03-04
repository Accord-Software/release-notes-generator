module.exports = {
  clearMocks: true,
  moduleFileExtensions: ["js", "json"],
  testMatch: ["**/tests/**/*.test.js"],
  testEnvironment: "node",
  collectCoverage: true,
  collectCoverageFrom: ["index.js"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
}
