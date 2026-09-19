# GitHub and challenge submission

The application README required by Change++ is **[README.txt](README.txt)**.
The original challenge brief remains in README.md.

Repository: [zachattack323/ImagePicker](https://github.com/zachattack323/ImagePicker).

## Repository setup

- The original challenge brief is preserved in README.md.
- `upstream` points to https://github.com/ChangePlusPlusVandy/Fall2026-CodingChallenge.
- `origin` points to https://github.com/zachattack323/ImagePicker.git.
- Dependencies, virtual environments, model weights, uploaded images,
  databases, generated builds, and archives are excluded from Git.
- The frontend package manager is pinned in `frontend/package.json`; commit
  `frontend/pnpm-lock.yaml` so reviewers get the same dependency versions.

## Before submission

1. README.txt includes Zachary Hixon and zachary.j.hixon@vanderbilt.edu in the required author section.
2. The reflection in README.txt uses my own wording and stays under 100 words.
3. Collection sharing is still unimplemented. README.txt documents this
   requirement gap; the repository is not claiming a fully complete challenge.
4. ImagePicker was created as a standalone GitHub repository. GitHub does not
   recognize it as a fork. The brief explicitly requests a fork; resolve that requirement
   before submitting, using the
   [official repository's Fork button](https://github.com/ChangePlusPlusVandy/Fall2026-CodingChallenge/fork)
   if needed.

## Push future changes

Authenticate Git with your GitHub account, then run from the project root
after reviewing your changes:

```sh
git add .
git diff --cached --check
git commit -m "Describe your changes"
git push -u origin main
```

Inspect `git remote -v` before changing remotes. If GitHub has newer commits,
fetch and reconcile them before pushing; do not force push over other work.

Dependencies, the local database, image uploads, virtual environments, and the
generated ZIP archives belong outside the GitHub source tree.

Finally, inspect README.txt on GitHub and submit your fork's URL through the
[completion form](https://forms.gle/JfR4cwAEwn4HhBuX8). The brief lists the
submission deadline as September 18, 2026 at 11:59 PM Central. Preparing the
repository does not submit the form.
