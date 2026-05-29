# Contributing to PetChain-MobileApp

Thank you for your interest in contributing to PetChain-MobileApp! We welcome contributions from the community to help improve this pet management mobile application with blockchain integration.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to [project-maintainers@example.com].

## How to Contribute

1. **Fork the Repository**: Click the "Fork" button on the GitHub repository page to create your own copy.

2. **Clone Your Fork**: Clone your forked repository to your local machine.
   ```
   git clone https://github.com/your-username/PetChain-MobileApp.git
   cd PetChain-MobileApp
   ```

3. **Create a Branch**: Create a new branch for your feature or bug fix.
   ```
   git checkout -b feature/your-feature-name
   ```

4. **Make Changes**: Implement your changes, following the coding standards below.

5. **Test Your Changes**: Run the test suite and ensure all tests pass.
   ```
   npm test
   ```

6. **Commit Your Changes**: Use clear, descriptive commit messages following the Conventional Commits format.

7. **Push to Your Fork**: Push your changes to your forked repository.
   ```
   git push origin feature/your-feature-name
   ```

8. **Submit a Pull Request**: Create a pull request from your branch to the main branch of the original repository.

## Coding Standards

To maintain high code quality, please follow these guidelines:

- **Clean Code Practices**: Write readable, maintainable code. Use meaningful variable and function names, avoid code duplication, and follow the Single Responsibility Principle.

- **Indentation**: Use 2 spaces for indentation consistently across all files.

- **Linting**: Ensure your code passes TypeScript type checking. Run `npm run typecheck` before submitting.

- **File Organization**: Follow the existing project structure. Place new files in appropriate directories (e.g., services in `src/services/`, utilities in `src/utils/`).

- **Documentation**: Add comments for complex logic and update documentation as needed.

## Commit Message Format

We use the [Conventional Commits](https://conventionalcommits.org/) specification for commit messages. This helps maintain a clear and organized git history.

Format: `type(scope): description`

Common types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
- `feat: add QR code generation for pet profiles`
- `fix: resolve authentication issue with blockchain service`
- `docs: update API documentation for pet service`

## Pull Request Requirements

Before submitting a pull request, ensure:

- Your PR targets the `main` branch.
- It includes a clear description of the changes made and the problem solved.
- All existing tests pass, and new tests are added for new features.
- The code passes TypeScript type checking (`npm run typecheck`).
- CI checks pass (including `npm run test:ci` for continuous integration).

Please keep PRs focused on a single feature or bug fix to make reviews easier.

## Issue Reporting

We use GitHub Issues to track bugs, feature requests, and general discussions.

### Bug Reports
When reporting a bug, please include:

- **Clear Title**: A concise description of the issue.
- **Steps to Reproduce**: Detailed steps to reproduce the bug.
- **Expected Behavior**: What you expected to happen.
- **Actual Behavior**: What actually happened.
- **Environment**: Your operating system, device, app version, and any relevant software versions.
- **Screenshots/Logs**: If applicable, include screenshots or error logs.

### Feature Requests
For new features, provide:
- **Clear Title**: A brief description of the requested feature.
- **Description**: Detailed explanation of the feature and its benefits.
- **Use Case**: How this feature would be used.

### General Guidelines
- Check existing issues before creating a new one.
- Use appropriate labels if available.
- Be respectful and constructive in discussions.

Thank you for contributing to PetChain-MobileApp!