# Galileo Glossary Hub

Static site, no build step. Data lives in `data/` as plain JSON files:
`glossary_decided.json` and `glossary_proposed.json` for the Glossary tab,
`search_index.json` for the search box, `data/shards/*.json` loaded on
demand for full per-term detail, plus the findings-tab data files.

## Push to your repo (github.com/PaulSohier/glossary-hub)

Unzip this next to your terminal, open a terminal in the unzipped `site`
folder, then:

```bash
git init
git add .
git commit -m "Galileo Glossary Hub"
git branch -M main
git remote add origin https://github.com/PaulSohier/glossary-hub.git
git push -u origin main
```

If the repo already has a commit (a README GitHub added automatically when
you created it), `git push` may be refused because the histories don't
match. In that case run `git pull --rebase origin main` first, resolve the
one-line README conflict if it asks, then `git push -u origin main` again.
Or simplest: clone the empty repo instead of running `git init`, then copy
this folder's contents into the clone and commit/push from there.

Then on github.com: open the repo, go to Settings > Pages > Source >
"Deploy from a branch", choose `main` and `/ (root)`, Save. The site goes
live at `https://paulsohier.github.io/glossary-hub/` within a minute or
two.

## Updating later

Re-running the analysis produces a new `data/` folder (and, when the
termbase changes, a new `glossary_decided.json` / `glossary_proposed.json`).
To update the live site, replace those files in the repo, commit, and
push - no other changes needed.
