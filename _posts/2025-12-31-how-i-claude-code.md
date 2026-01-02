---
layout: post
title: How I Claude Code
permalink: how-i-claude-code
---

At some point, I noticed I was spending more energy re-establishing context than actually doing the work. Explaining the stack again. Retracing familiar debugging steps. Remembering commands I already knew. None of it was hard, but all of it broke the flow and felt waste.

I didn't want another assistant adding noise. I wanted something that kept up with how I actually work, something that understood the patterns without needing to relearn them every time.

This is what _that_ ended up looking like.

## It's Not Just a Chatbot

The biggest mindset shift was treating Claude Code as a configurable tool, not a magic chat window. Out of the box it suggests generic solutions. But the real power comes from teaching it *how you work*.

My `~/.claude/CLAUDE.md` file contains:
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
    - Use security-code-reviewer agent to verify no secrets exposed
5. **Present Findings** with file/line references
6. **Ask for Approval** - ALWAYS explicitly ask before approving
7. **Approve if Confirmed** - gh pr review --approve (never mention AI)
```

The key insight: skills can **compose agents**. The pr-review skill dynamically delegates to `dev-functional` for application code or `github-actions-expert` for CI/CD changes. This gives me specialized review depth without manually switching context.

I invoke it with just: "review PR 847" - and it runs the entire workflow.

## Skills for Domain Knowledge

Beyond workflow skills, domain-specific skills encode institutional knowledge—the tribal knowledge that lives in someone's head or a wiki that everyone forgot.

A skill might know all the environments (Dev, Int, Prd etc) and their endpoints, the right profiles, common query patterns, the field names scattered across your logs. Without it, you're copy-pasting commands and hunting for details. With it, you describe what you need and it constructs the right thing. The knowledge stays encoded, not forgotten.

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
└── skills/
    ├── pr-review/
    ├── commit/
    ├── open-search-query/
    ├── recomp/
    └── youtube-transcript/
```

Skills have become my primary interface. I used to rely on slash commands for quick actions, but skills proved more flexible: they can compose agents, run multi-step workflows, and maintain context more reliably. Even committing code is now handled as a skill.

Each skill lives in its own directory with a SKILL.md file that Claude executes autonomously. Agents supply the expertise; skills orchestrate the process. Together, they remove the friction of context switching and command hunting.

## What Actually Changed

Before Claude Code, PR reviews were a context-switch tax. Read the code, check CI, look up related patterns, write comments. Each step a small interruption.

Now the pr-review skill handles the ceremony. It fetches everything, delegates to the right expert agent, and presents findings. I focus on the judgment calls.

The time savings are real, but the *cognitive load* savings matter more.

## What Doesn't Work (Yet)

- Complex multi-file refactors still need human oversight
- It occasionally suggests over-engineered solutions
- The "let me search the codebase" loop can burn through context

I've learned: be specific about what you're asking. "Fix the null check in line 47" beats "fix this bug." Precision reduces hallucination.

## The Meta Skill

The real skill isn't prompting. It's context engineering.

Not context dumping, I’m careful about what goes into CLAUDE.md and agents. Too much noise and Claude gets confused. Too little and it defaults to generic advice. The goal is precision: enough information to eliminate guessing, not so much that it becomes cargo cult.

It's also about nudging. When dev-functional suggests something I disagree with, I don't ask it to "be better”, I give it the specific constraint it missed. *"This approach won't work because our CDK stack expects immutable configurations."* Now it understands the real boundary, not an invented one.

Every time I repeat a workflow more than three times, I ask: should this be encoded as a skill? Every time I catch myself explaining obvious context, I ask: should this live in an agent definition? The goal is to remove friction, so thinking can be effortless again.

That’s the practice: engineering context with enough precision that the agent becomes an extension of your thinking, not a substitute for it.
