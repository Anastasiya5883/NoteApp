# Initial GitHub pull request design

## Goal

Publish the existing local application to `Anastasiya5883/NoteApp` through a reviewable pull request while preserving any remote history and excluding local or sensitive files.

## Repository safety

- Re-authenticate GitHub CLI before reading or changing the remote repository.
- Inspect the remote default branch before pushing.
- Never force-push or overwrite existing remote history.
- If the remote repository is empty, establish `main` with the repository-safety files, then create `codex/initial-project` for the application import.
- If the remote repository already has history, create `codex/initial-project` from its default branch and integrate the local project there.

## Ignore policy

The root `.gitignore` will exclude:

- Node and pnpm dependency/cache directories;
- client and server build output;
- environment files while explicitly retaining `.env.example`;
- SQLite runtime databases and their journal files;
- logs, test coverage, temporary files, editor metadata, and common OS metadata.

The tracked `.env.example` will contain names and safe placeholder values only. No runtime secrets will be committed.

## Publication flow

1. Refresh GitHub CLI authentication for `Anastasiya5883`.
2. Inspect the repository and its default branch.
3. Update `.gitignore` and verify ignored-file behavior with `git check-ignore`.
4. Run the existing test and build commands.
5. Create commits without including ignored or sensitive files.
6. Push `codex/initial-project` and open a pull request into the remote default branch.
7. Verify the pull request URL and status with GitHub CLI.

## Failure handling

- Stop before pushing if authentication, repository ownership, or default-branch state cannot be verified.
- Stop if tests or the build fail and report the exact failure.
- Stop if remote history conflicts with the local project; do not resolve it with destructive Git operations.
