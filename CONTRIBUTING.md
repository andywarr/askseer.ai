# Contributing to Seer

First of all, thank you for taking the time to contribute to Seer! We welcome community contributions, bug reports, and feedback to help make Seer better.

By contributing to this project, you agree that your contributions will be licensed under the project's [LICENSE](LICENSE) (PolyForm Noncommercial License 1.0.0).

---

## Code of Conduct

Please read and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) in all community spaces and interactions.

---

## How Can I Contribute?

### 1. Reporting Bugs & Requesting Features
- Search the open issues to see if the problem or feature has already been reported.
- If not, open a new issue. Please include:
  - A clear and descriptive title.
  - Steps to reproduce the bug (for bug reports).
  - What you expected to happen vs. what actually happened.
  - Screenshots or logs if applicable.

### 2. Submitting Pull Requests (PRs)
- **Discuss First**: For major changes or new features, please open an issue to discuss your proposed design before writing code. This ensures alignment and saves you time.
- **Branch Naming**: Use descriptive branch names (e.g., `feature/add-new-metric`, `fix/login-redirect`).
- **Local Setup**: Follow the setup instructions in the [README.md](README.md) to set up your local development environment.
- **Keep it Focused**: Keep your pull requests small and focused on a single change. Avoid bundling unrelated fixes or features together.

---

## Code Style & Standards

We use the following tooling to maintain code quality:
- **TypeScript** for static typing.
- **ESLint** for code analysis.
- **Prettier** for formatting.

Before submitting a PR, make sure your code builds and passes linting:
```bash
# Run type checking across the workspaces
yarn type-check

# Run linter
yarn workspaces foreach -A run lint
```

### Tests
We write unit and integration tests using **Vitest**. Make sure all tests pass before submitting a PR:
```bash
# Run tests across all workspaces
yarn test
```

### Commit Messages
We encourage the use of semantic commit messages to keep our Git history readable:
- `feat:` for new user-facing features.
- `fix:` for bug fixes.
- `docs:` for documentation changes.
- `style:` for formatting and style-only changes.
- `refactor:` for code changes that neither fix bugs nor add features.
- `test:` for adding or fixing tests.
- `chore:` for updating build configurations, dependencies, etc.
