# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Seer, please report it responsibly. **Do not open a public issue.**

Instead, email us at **[security@askseer.ai](mailto:security@askseer.ai)** with the following details:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (if applicable)

## Response Timeline

- **Acknowledgment**: We will acknowledge receipt of your report within **5 business days**.
- **Initial Assessment**: We will provide an initial assessment within **20 business days**.
- **Resolution**: We will provide an estimated time to resolve confirmed vulnerabilities within **60 business days**, depending on complexity.

## Supported Versions

Security updates are applied to the latest version on the `main` branch only.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | ✅ Yes             |
| Older   | ❌ No              |

## Disclosure Policy

- We will coordinate with you on disclosure timing.
- We will credit reporters in the fix announcement unless anonymity is requested.
- We ask that you do not publicly disclose the vulnerability until we have released a fix.

## Scope

The following are in scope for security reports:

- Authentication and authorization bypasses
- Data exposure or leakage
- Injection vulnerabilities (SQL, XSS, etc.)
- Server-side request forgery (SSRF)
- Insecure dependencies with known CVEs

The following are **out of scope**:

- Denial of service (DoS) attacks
- Social engineering
- Issues in third-party services (e.g., OpenAI, AWS, Stripe)
- Issues requiring physical access to a user's device

Thank you for helping keep Seer and its users safe.
