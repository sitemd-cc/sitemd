---
name: feedback
description: Submit a bug report, feature request, or question about sitemd.
---

# Submit Feedback

Report a bug, request a feature, or ask a question about sitemd.

## Input

Arguments: `$ARGUMENTS`

If provided, parse the first word as a type (`bug`, `feature`, `question`) if it matches. Remaining words become the title. If no arguments, ask the user what they want to report.

## Procedure

### 1. Gather details

Ask the user (if not already clear from conversation context):
- **Type**: bug, feature, or question
- **Title**: one-line summary
- **Details**: for bugs, what happened vs. what was expected. For features, the desired behavior.

If there was an error earlier in the conversation, auto-populate the body with that error context (message, stack trace, what was attempted).

### 2. Submit

Direct the user to report the issue on GitHub:
- Open `https://github.com/sitemd-cc/sitemd/issues/new`
- Pre-fill the title and body if possible using URL parameters

### 3. Present the result

Tell the user:
- Share the GitHub issue link
- Suggest including environment info (sitemd version, Node, OS)
- They can edit the content before submitting on GitHub

## Rules

- Keep the title under 80 characters
- For bugs, always include: what happened, what was expected, steps to reproduce
- For features, describe the desired behavior, not the implementation
- If an error occurred earlier in the conversation, include it in the body
