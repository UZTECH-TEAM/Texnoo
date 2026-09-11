# Security Policy

## Reporting a Vulnerability

We take the security of Texnoo seriously. If you discover a security vulnerability in this repository, please **do not** open a public GitHub issue. Instead, please report it responsibly by following the steps below.

### How to Report a Security Vulnerability

1. **Email**: Send a detailed report to the maintainers at the repository's security contact
2. **GitHub Security Advisory**: You can also use GitHub's private vulnerability reporting feature by going to the repository's Security tab and clicking "Report a vulnerability"
3. **Include the following information**:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact and severity
   - Suggested fix (if available)
   - Your contact information

### Response Timeline

- **Initial Response**: We aim to acknowledge receipt of vulnerability reports within 48 hours
- **Investigation**: We will investigate and assess the vulnerability severity
- **Fix Development**: We will work on developing and testing a fix
- **Disclosure**: Once a fix is available, we will coordinate with you on responsible disclosure timing

## Security Best Practices

When using Texnoo, please follow these security best practices:

### For Users
- Keep Texnoo and all dependencies up to date
- Review security advisories regularly
- Use HTTPS when deploying Texnoo in production
- Implement proper authentication and authorization mechanisms
- Sanitize user input to prevent injection attacks
- Use environment variables for sensitive configuration data
- Never commit secrets, API keys, or credentials to the repository

### For Developers
- Validate and sanitize all user inputs
- Use parameterized queries to prevent SQL injection
- Keep dependencies updated and monitor for vulnerabilities
- Follow OWASP security guidelines
- Implement proper error handling without exposing sensitive information
- Use security headers in HTTP responses
- Enable CORS only for trusted origins
- Implement rate limiting on API endpoints

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | ✅ Fully supported |
| N-1     | ✅ Security fixes  |
| Older   | ❌ Not supported   |

## Dependency Management

We regularly update dependencies to patch known security vulnerabilities. Users are encouraged to:
- Enable GitHub's dependabot alerts
- Review and apply security updates promptly
- Report any security issues with dependencies

## Security Measures in Place

- Regular code reviews
- Input validation and sanitization
- Error handling that doesn't expose sensitive information
- HTTPS enforcement for sensitive operations
- Environment-based configuration for sensitive data

## Additional Resources

- [GitHub Security Advisory](https://github.com/UZTECH-TEAM/Texnoo/security/advisories)
- [Dependabot Alerts](https://github.com/UZTECH-TEAM/Texnoo/security/dependabot)
- [Code Scanning](https://github.com/UZTECH-TEAM/Texnoo/security/code-scanning)
- [Secret Scanning](https://github.com/UZTECH-TEAM/Texnoo/security/secret-scanning)

## Contact

For security-related questions or concerns, please reach out to the UZTECH-TEAM maintainers through the security advisory channel.

---

**Thank you for helping keep Texnoo secure!**
