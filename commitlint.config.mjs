/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // new feature
        "fix",      // bug fix
        "docs",     // documentation only
        "style",    // formatting, missing semicolons, etc (no logic change)
        "refactor", // code change that is neither a fix nor a feature
        "perf",     // performance improvement
        "test",     // adding or updating tests
        "build",    // build system or external dependency changes
        "ci",       // CI/CD configuration changes
        "chore",    // other changes that don't modify src or test files
        "revert",   // reverts a previous commit
      ],
    ],
    "subject-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [1, "always"],
    "footer-leading-blank": [1, "always"],
  },
};
