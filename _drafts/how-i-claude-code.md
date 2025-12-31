---
layout: post
title: How I Claude Code
permalink: how-i-claude-code
---

A few months ago, Claude Code went from "interesting experiment" to "can't imagine working without it." Here's how I've shaped it into my daily workflow.

## It's Not Just a Chatbot

The biggest mindset shift was treating Claude Code as a configurable tool, not a magic oracle. Out of the box it's useful. But the real power comes from teaching it *how you work*.

My `~/.claude/CLAUDE.md` file is now over 300 lines. It contains:
- Custom agents for specific tasks
- Skills that encode complex workflows
- Git conventions (lowercase commits, no Claude attribution)
- PR review rules (always ask before approving)

This isn't about making Claude "smarter" - it's about making it *predictable*. When I invoke a skill, I know exactly what process it will follow.

## Skills: Codified Workflows

Skills are my most-used Claude Code feature. They live in `~/.claude/skills/<skill-name>/SKILL.md` and encode multi-step workflows that Claude executes autonomously.

My **pr-review** skill is the one I reach for daily. Here's what it does:

```markdown
# PR Review Skill

1. **Fetch PR Details**: gh pr view <PR_NUMBER> --json title,body,author,commits,files...
2. **Analyze Changes**: gh pr diff <PR_NUMBER>
3. **Check CI Status**: gh pr checks <PR_NUMBER>
4. **Review the Changes**:
   - Use dev-functional agent OR github-actions-expert agent depending on changes
   - Assess code quality, security, tests, error handling
   - Verify no secrets exposed
5. **Present Findings** with file/line references
6. **Ask for Approval** - ALWAYS explicitly ask before approving
7. **Approve if Confirmed** - gh pr review --approve (never mention AI)
```

The key insight: skills can **compose agents**. The pr-review skill dynamically delegates to `dev-functional` for application code or `github-actions-expert` for CI/CD changes. This gives me specialized review depth without manually switching context.

I invoke it with just: "review PR 847" - and it runs the entire workflow.

## Agents for Context Switching

Agents live in `~/.claude/agents/<name>.md` and define specialized personas with specific expertise.

**dev-functional** is my principal engineer brain. When I invoke it, I get someone who understands:
- Kotlin coroutines and structured concurrency patterns
- gRPC error handling with proper status codes and service boundaries
- Production concerns: observability, circuit breakers, graceful degradation
- Existing codebase patterns and architectural decisions

Example usage: I say *"Design customer validation for a gRPC service"* and it immediately thinks in terms of Kotlin coroutines, proper error handling, and service patterns—not generic best practices. It pushes back on over-engineering.

**security-code-reviewer** is my pre-commit paranoia. It systematically scans for:
- Exposed API keys, database credentials, OAuth secrets
- Hardcoded tokens and configuration values
- OWASP vulnerabilities and logging that might leak sensitive data

I invoke it with: *"Review my changes before committing"* and it catches the credentials I would've missed while moving fast.

**github-actions-expert** speaks fluent YAML and GitHub's automation model. Handles workflow optimization, reusable components, and the quirks that make CI/CD debugging tedious. When my build fails mysteriously, this agent knows exactly where to look.

## Skills for Domain Knowledge

Beyond workflow skills, I have domain-specific skills that encode institutional knowledge.

**open-search-query** is a perfect example. It knows:
- Our three environments (dev, int, prd) with their specific endpoints
- The correct AWS SSO profiles for each (`trip.dev`, `trip.int`, `trip.prd`)
- Index patterns (`applications-*`, `k8s-*`, `vehicle-integration-logs-*`)
- Field names for our logs (`tripId`, `vehicleId`, `requestId`, `traceId`)
- Common query patterns pre-built

Without this skill, I'd be copy-pasting awscurl commands and looking up field names. Now I just say "search for errors in prd with tripId X" and it constructs:

```bash
bash -c 'unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN && \
  aws-sso exec -p trip.prd -- awscurl --service es -XPOST \
  "https://search-cfn-ela.../_search" \
  -d '{"query": {"term": {"tripId": "<trip-id>"}}}'
```

The skill even handles the AWS credential conflict workaround (unsetting env vars before aws-sso exec). That's tribal knowledge that would otherwise live in someone's head or a wiki nobody reads.

## The Structure That Matters

Here's my `~/.claude/` directory structure:

```
~/.claude/
├── CLAUDE.md           # Global instructions
├── agents/
│   ├── dev-functional.md
│   ├── security-code-reviewer.md
│   ├── github-actions-expert.md
│   └── docs.md
├── skills/
│   ├── pr-review/
│   │   └── SKILL.md
│   └── open-search-query/
│       └── SKILL.md
├── slash-commands/
│   ├── commit.md
│   ├── PRs.md          # Dependabot automation
│   └── worklog.md
└── workflows/
    └── templates/
        ├── feature-workflow.md
        └── bugfix-workflow.md
```

Each piece has a purpose:
- **Agents**: Specialized personas for different types of work
- **Skills**: Multi-step workflows Claude executes (SKILL.md files)
- **Slash commands**: Quick actions invoked with `/command`
- **Workflows**: Templates for larger processes (feature dev, bugfixes)

## What Actually Changed

Before Claude Code, PR reviews were a context-switch tax. Read the code, check CI, look up related patterns, write comments. Each step a small interruption.

Now the pr-review skill handles the ceremony. It fetches everything, delegates to the right expert agent, and presents findings. I focus on the judgment calls.

For production debugging, the open-search-query skill eliminated the "how do I query this again?" friction. The domain knowledge is encoded, not forgotten.

The time savings are real, but the *cognitive load* savings matter more.

## What Doesn't Work (Yet)

- Complex multi-file refactors still need human oversight
- It occasionally suggests over-engineered solutions
- The "let me search the codebase" loop can burn through context

I've learned to be specific: "Fix the null check in line 47" beats "fix this bug."

## The Meta Skill

The real skill isn't prompting. It's knowing what to encode.

Every time I repeat a workflow more than twice, I consider: should this be a skill? Every time I explain context that should be obvious, I consider: should this be in an agent definition?

The goal isn't automating everything. It's eliminating the friction that breaks flow.

---

*How do you Claude Code? I'm curious what workflows others have built.*
