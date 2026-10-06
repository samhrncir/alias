# ALIAS // bash alias deck

A cyberpunk web app for managing the aliases in your `~/.bashrc`.

- **Point it at your file, once per PC.** Chrome and Edge remember the linked `.bashrc`
  (File System Access API). Other browsers get a copy/download mode.
- **Alias owns one block.** Everything between `# >>> ALIAS >>>` and `# <<< ALIAS <<<` is
  regenerated from your library; the rest of the file is left alone. Every write shows a
  diff first and keeps a backup of the previous file (last 20, in this browser).
- **Optional sync.** Signed out, the library lives in this browser. Sign in to share it
  across PCs through Supabase.
- **Three themes:** Night City, Synthwave and Netrunner (`T` cycles).

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests, including a round trip through real bash when it's on PATH
npm run lint
npm run build
```

## Configuration

Copy `.env.example` to `.env.local`. Both variables are optional; leave them unset to run
local-only.

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |

The schema is in `supabase/migrations/0001_aliases.sql`: one row per alias, with row-level
security so each user only sees their own. For magic-link sign-in, add the app's URL under
Supabase → Authentication → URL Configuration → Redirect URLs.

## After a write

Shells that are already open keep the old aliases until you run `source ~/.bashrc`.

On Windows, Git Bash reads `~/.bashrc` through `~/.bash_profile`. If that file is missing,
Git Bash creates it on the next launch and prints a one-time warning.
