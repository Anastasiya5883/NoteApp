# Initial GitHub Pull Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing application to `Anastasiya5883/NoteApp` through a safe, reviewable pull request with local and sensitive files excluded.

**Architecture:** Keep the local repository as the source of the application, expand its root ignore policy, and validate the application before publication. Re-authenticate GitHub CLI, inspect the remote before changing it, preserve existing history, and use `codex/initial-project` for the application import without force-pushing.

**Tech Stack:** Git, GitHub CLI 2.97.0, Git for Windows, pnpm, Node.js, Vite, TypeScript, React, Express

## Global Constraints

- Target repository: `https://github.com/Anastasiya5883/NoteApp`.
- Never force-push or overwrite existing remote history.
- Keep `.env.example`; exclude runtime environment files and SQLite data.
- Stop before pushing if authentication, ownership, or the remote default branch cannot be verified.
- Stop and report exact output if tests or the production build fail.

---

### Task 1: Complete the repository ignore policy

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the existing Node/Vite/TypeScript/Express directory layout.
- Produces: a root ignore policy used by every later staging and publication step.

- [ ] **Step 1: Record representative ignored and retained paths**

Use these paths as the acceptance cases:

```text
node_modules/example.js                  ignored
.pnpm-store/state.json                   ignored
dist/index.html                          ignored
server-dist/index.js                     ignored
.env                                     ignored
.env.local                               ignored
.env.production                          ignored
.env.example                             retained
server/data/app.db                       ignored
server/data/app.db-wal                   ignored
coverage/lcov.info                       ignored
npm-debug.log                            ignored
.vscode/settings.json                    ignored
.idea/workspace.xml                      ignored
.DS_Store                                ignored
Thumbs.db                                ignored
```

- [ ] **Step 2: Run the acceptance cases before editing**

Run each path through `git check-ignore -v --no-index <path>` and record which required cases are not yet matched. Expected before editing: `.env.local`, `.env.production`, coverage, logs, editor metadata, and OS metadata are not all covered.

- [ ] **Step 3: Replace `.gitignore` with the complete policy**

```gitignore
# Dependencies and package-manager caches
node_modules/
.pnpm-store/

# Build output
dist/
server-dist/

# Environment files
.env
.env.*
!.env.example

# Runtime database files
server/data/*.db
server/data/*.db-*

# Tests and logs
coverage/
*.log
npm-debug.log*
pnpm-debug.log*

# Tool caches and temporary files
.cache/
.vite/
*.tmp
*.temp

# Editors and operating systems
.vscode/
.idea/
.DS_Store
Thumbs.db
```

- [ ] **Step 4: Re-run all acceptance cases**

Run `git check-ignore -v --no-index` for every path from Step 1. Expected: every path marked `ignored` reports a matching rule; `.env.example` exits without an ignore match.

- [ ] **Step 5: Commit the ignore policy**

```powershell
git add -- .gitignore
git commit -m "chore: complete repository ignore rules"
```

### Task 2: Validate and commit the application

**Files:**
- Add: `.env.example`
- Add: `index.html`
- Add: `package.json`
- Add: `pnpm-lock.yaml`
- Add: `pnpm-workspace.yaml`
- Add: `server/`
- Add: `src/`
- Add: `tsconfig.json`
- Add: `tsconfig.server.json`
- Add: `vite.config.ts`

**Interfaces:**
- Consumes: the ignore policy from Task 1 and scripts declared in `package.json`.
- Produces: a tested application commit ready for a publication branch.

- [ ] **Step 1: Verify no sensitive or ignored files would be committed**

```powershell
git status --short --ignored
git check-ignore -v --no-index .env .env.local server/data/app.db
```

Expected: runtime environment/database paths are ignored and `.env.example` remains untracked or staged normally.

- [ ] **Step 2: Run the automated tests**

```powershell
pnpm test
```

Expected: exit code `0` and zero failed tests.

- [ ] **Step 3: Run the production build**

```powershell
pnpm build
```

Expected: exit code `0`; `dist/` and `server-dist/` may be generated but remain ignored.

- [ ] **Step 4: Stage only the intended application files**

```powershell
git add -- .env.example index.html package.json pnpm-lock.yaml pnpm-workspace.yaml server src tsconfig.json tsconfig.server.json vite.config.ts
git diff --cached --stat
git diff --cached --name-only
```

Expected: no `.env`, database, build-output, dependency, log, editor, or OS files appear.

- [ ] **Step 5: Commit the application**

```powershell
git commit -m "feat: add technical requirements assistant"
```

### Task 3: Restore authenticated GitHub connectivity

**Files:**
- Modify outside repository: current user's GitHub CLI credential store.
- Modify outside repository only if required: current user's Git for Windows installation and `PATH`.

**Interfaces:**
- Consumes: GitHub account `Anastasiya5883` and official GitHub/Git-for-Windows releases.
- Produces: valid `gh auth status` and a Git executable containing `git-remote-https.exe`.

- [ ] **Step 1: Refresh GitHub CLI authentication interactively**

```powershell
gh auth refresh -h github.com
```

Complete the browser/device confirmation for `Anastasiya5883`.

- [ ] **Step 2: Verify authentication and repository access**

```powershell
gh auth status
gh repo view Anastasiya5883/NoteApp --json nameWithOwner,isPrivate,defaultBranchRef
```

Expected: authentication succeeds and `nameWithOwner` equals `Anastasiya5883/NoteApp`.

- [ ] **Step 3: Check HTTPS Git support**

```powershell
$gitExecPath = git --exec-path
Test-Path -LiteralPath (Join-Path $gitExecPath 'git-remote-https.exe')
```

Expected: `True`. If it is `False`, download the latest official 64-bit PortableGit release from `git-for-windows/git`, verify the published SHA-256 digest, extract it under `%LOCALAPPDATA%\Programs\Git`, and prepend its `cmd` directory to the current user's `PATH`.

```powershell
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{ 'User-Agent' = 'Codex-Git-Installer' }
$asset = $release.assets | Where-Object { $_.name -match '^PortableGit-.*-64-bit\.7z\.exe$' } | Select-Object -First 1
if (-not $asset) { throw 'Official PortableGit 64-bit asset was not found.' }
$taskTemp = Join-Path ([System.IO.Path]::GetTempPath()) ('codex-git-' + [guid]::NewGuid().ToString('N'))
$installRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('Programs\Git\' + $release.tag_name)
New-Item -ItemType Directory -Path $taskTemp, $installRoot -Force | Out-Null
try {
    $archive = Join-Path $taskTemp $asset.name
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archive -Headers @{ 'User-Agent' = 'Codex-Git-Installer' }
    if ($asset.digest -notmatch '^sha256:(.+)$') { throw 'Release asset has no SHA-256 digest.' }
    $expectedHash = $Matches[1].ToLowerInvariant()
    $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) { throw 'PortableGit SHA-256 verification failed.' }
    & $archive "-o$installRoot" -y
    if ($LASTEXITCODE -ne 0) { throw "PortableGit extraction failed with exit code $LASTEXITCODE." }
    $gitCmd = Join-Path $installRoot 'cmd'
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $pathParts = @($userPath -split ';' | Where-Object { $_ })
    if ($pathParts -notcontains $gitCmd) {
        [Environment]::SetEnvironmentVariable('Path', (($gitCmd + $pathParts) -join ';'), 'User')
    }
    $env:Path = (($gitCmd + @($env:Path)) -join ';')
} finally {
    Remove-Item -LiteralPath $taskTemp -Recurse -Force -ErrorAction SilentlyContinue
}
```

- [ ] **Step 4: Verify the effective Git installation**

```powershell
git --version
$gitExecPath = git --exec-path
Test-Path -LiteralPath (Join-Path $gitExecPath 'git-remote-https.exe')
git ls-remote --symref https://github.com/Anastasiya5883/NoteApp.git HEAD
```

Expected: the helper check returns `True`, and `ls-remote` either lists the remote default branch or exits successfully with no refs for an empty repository.

### Task 4: Reconcile the remote safely and open the pull request

**Files:**
- Modify: repository-local Git configuration (`origin` remote).
- No project file changes beyond Tasks 1 and 2.

**Interfaces:**
- Consumes: validated commits from Tasks 1-2 and authenticated connectivity from Task 3.
- Produces: remote branch `codex/initial-project` and a pull request into the repository default branch.

- [ ] **Step 1: Add the target remote and inspect refs**

```powershell
$targetRemote = 'https://github.com/Anastasiya5883/NoteApp.git'
$currentRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    if ($currentRemote -ne $targetRemote) { throw "Existing origin points to $currentRemote" }
} else {
    git remote add origin $targetRemote
}
git ls-remote --symref origin HEAD
git ls-remote --heads origin
```

If `origin` already exists, verify that `git remote get-url origin` exactly matches the target instead of adding it again.

- [ ] **Step 2: Preserve or establish the base branch**

Resolve the remote default branch and preserve the local import snapshot:

```powershell
$headInfo = git ls-remote --symref origin HEAD
$headMatch = $headInfo | Select-String '^ref: refs/heads/(\S+)\s+HEAD$'
$defaultBranch = if ($headMatch) { $headMatch.Matches[0].Groups[1].Value } else { 'main' }
git branch local/import-snapshot HEAD
```

If the remote has a default branch, base the PR branch on it and copy the validated local snapshot without rewriting the remote:

```powershell
if ($headMatch) {
    git fetch origin $defaultBranch
    git switch -c codex/initial-project "origin/$defaultBranch"
    git checkout local/import-snapshot -- .
    git add -A
    git commit -m "feat: add technical requirements assistant"
}
```

If the remote has no refs, establish `main` at the ignore-policy commit (`HEAD~1` after Task 2), then create the PR branch at the full application commit:

```powershell
if (-not $headMatch) {
    $applicationCommit = git rev-parse HEAD
    $baseCommit = git rev-parse HEAD~1
    git push origin "${baseCommit}:refs/heads/main"
    git switch -c codex/initial-project $applicationCommit
    $defaultBranch = 'main'
}
```

- [ ] **Step 3: Push the publication branch**

```powershell
git push -u origin codex/initial-project
```

Expected: a new remote branch is created without `--force`.

- [ ] **Step 4: Create the pull request**

```powershell
gh pr create --repo Anastasiya5883/NoteApp --base main --head codex/initial-project --title "Add technical requirements assistant" --body "Adds the React/Vite and Express application, repository-safe ignore rules, environment-variable example, tests, and production build configuration."
```

If the verified remote default branch is not `main`, use that exact branch in `--base`.

- [ ] **Step 5: Verify the pull request and working tree**

```powershell
gh pr status --repo Anastasiya5883/NoteApp
gh pr view --repo Anastasiya5883/NoteApp --json number,url,state,baseRefName,headRefName,statusCheckRollup
git status --short --branch
```

Expected: the PR is `OPEN`, its head is `codex/initial-project`, its base is the verified default branch, and the working tree is clean except for ignored build output.
