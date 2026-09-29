---
name: release-notes
description: Write the release notes for a multi-looper version from git history and add them to CHANGELOG.md. Use when the user runs /release-notes or asks for release notes or a changelog entry.
disable-model-invocation: true
argument-hint: "[version, e.g. 1.7]"
allowed-tools: Bash(git log:*), Bash(git tag:*), Bash(git show:*), Bash(git diff:*), Bash(git describe:*), Bash(git rev-parse:*)
---

Add one release's section to `CHANGELOG.md`, then print a short "What's new" for the Play Store.

## 1. Pick the release and its commit range

Tags are `vX.Y` (or `vX.Y.Z`), made by `just set-version`, which tags the version-bump commit itself. List them with `git tag --sort=-v:refname`.

- **Argument given** (`$ARGUMENTS`, e.g. `1.7`): the release is `v1.7`.
  - If tag `v1.7` exists: range is `<previous tag>..v1.7`, date is the tag commit's date (`git log -1 --format=%as v1.7`).
  - If not (notes written before tagging): range is `<latest tag>..HEAD`, date is today.
- **No argument**: take the newest tag. If CHANGELOG.md has no `## <tag>` section yet, write that one (range `<previous tag>..<tag>`). If it already has one, stop and ask which version to write.

If CHANGELOG.md already has a section for the release, rewrite it in place instead of adding a second one.

## 2. Read what changed

`git log --no-merges --format='%h %s' <range>`. Commit subjects use `feat:`, `fix:`, `doc:`.

- Skip the bare version commits (subject `vX.Y`) and changelog-only commits.
- A subject is often too terse to tell a user what changed. When it is, read the commit (`git show --stat <sha>`, then the relevant diff) before writing the line.
- Merge commits that are the same change (a feature and its follow-up fixes) into one line. A fix to something introduced in this same release is not a separate "Fixes" entry.

## 3. Write the section

Match the existing entries in CHANGELOG.md (read the top two first):

```markdown
## v1.7 (2026-10-04)

### Features
- **Big feature name**: what it lets the user do
- Smaller change, one line

### Fixes
- What was broken, described as the behaviour that now works

### Docs
- ...

### Dev
- Tooling, recipes, build and release changes
```

- Headings in this order, only the ones with entries: Features, Fixes, Docs, Dev.
- Written for users of the app, not for reviewers of the code: what they can now do or what no longer goes wrong. No file names, function names or commit hashes, except for `just` recipes and env vars under Dev.
- Bold lead-in only for headline features.
- No em dashes anywhere (use commas, colons, periods or " - ").
- New section goes directly under `# Changelog`, newest first.

## 4. Report

Print the section you wrote, then a plain-text "What's new" for the Play Store listing: 500 characters max, user-facing Features and Fixes only, no markdown, one short line per item.

Never commit. The user commits (suggest `doc: add vX.Y to CHANGELOG`).
