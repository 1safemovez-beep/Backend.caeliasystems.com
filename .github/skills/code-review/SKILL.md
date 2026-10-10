---
name: code-review
description: Review pull requests for quality, security, and Caelia architecture compliance.
---
# Code Review Skill

## Purpose
Review code changes in this repo for quality, security, and Caelia architecture compliance.

## When to use
- Before merging any pull request
- After Copilot or any agent makes changes
- When Alicia asks "is this right?"

## Review checklist
1. **Secrets**: No API keys, tokens, or passwords in the code. All secrets must come from environment variables.
2. **Caelia architecture**: Changes must follow CAELIA_COPILOT_MASTER_INSTRUCTIONS.md — flag anything that breaks those rules as [AWAITING PART], never guess.
3. **API routes**: New endpoints must be documented. Check that /api/health, /api/chat, /api/teach, /api/failsafe, /api/engines/:id still work.
4. **Compactness**: Keep the backend lean. No unnecessary dependencies.
5. **Error handling**: Failures must return useful JSON, not crash the server.

## Output format
For each issue found:
- **File and line**: where it is
- **Severity**: blocker, warning, or nitpick
- **What to do**: specific fix

If no issues: say "Clean — safe to merge."
