# Darts Scorer: notes for Claude

Ryan's darts scoring app. Live at https://drknss89.github.io/darts-scorer/ (GitHub Pages, `main` branch, root).
Also installed as an Android app (PWABuilder / Trusted Web Activity, package `io.github.drknss89.darts`),
which simply loads this site, so pushing to `main` updates the Android app too.

## Files
- `index.html`: the whole app (HTML, CSS and JS in one file). Edit this directly.
- `sw.js`: service worker. Bump `CACHE` (e.g. `darts-v2` → `darts-v3`) when icons or the manifest change.
- `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png`: install/app icons (Ryan's dartboard picture).
- The sibling repo `drknss89.github.io` only holds `.nojekyll` and `.well-known/assetlinks.json` for the Android app. Don't touch it unless the app's signing key changes.

## Services wired into index.html (public client config, safe to keep in the file)
- **Firebase** project `darts-scorer-c9db4`: Realtime Database (online games, accounts) and Auth (email/password + Google).
  - `games/{CODE}`: online game state (`state.match` and `state.hist` as JSON strings), `claims`, `session` (games, ended, host, sent).
  - `users/{uid}`: `name`, `guests/{gid}`, `history/{sessionId}` (per-player stats; careers are computed from history).
  - Rules: games readable/writable by any signed-in user; users/{uid} only by that user.
- **Email**: a Google Apps Script web app (`MAILER` constant: url + shared key) sends the recap emails from Ryan's Gmail (~100/day).
  EmailJS is a fallback only (`EMAILJS` constant).

## How the app is organised (search these names in index.html)
- Settings/setup: `settings`, `renderSetup`, `CATS` (game categories), `NAMES`, `gameName`, `rulesFor`.
- Setup is three pages (`setupStep` 1 Game, 2 Options, 3 Players; `stepsBar`). Page 1: resume/join cards, `quickPicks()` (My default, Quick 501, Quick Cricket, Medley, Same as last time; `data-quick`) and the game list (tapping a game goes to page 2, or straight to 3 when `hasOptionsStep` is false). Page 2: `gameOptionsHtml` + format. Page 3: players, teams, throws first, Start/Host (and the online host's next-game card). Entering setup from another screen resets to page 1 (in `render()`).
- Screens: `render()` switches `screen` between `loading`, `auth`, `home`, `players`, `setup`, `game`.
- Match state: `match` (snapshotted into `hist` for undo via `snapshot()`), `startMatch`, `newLeg`, `endLeg`, `nextLeg`.
- Games:
  - X01: turn-total entry, `submitScore`, `finish`, darts-at-double prompt `ddAsk`.
  - Cricket / Cut-Throat: `throwDart`.
  - Killer: `killerDart`, `pickNumber`.
  - Halve-It: `halveDart`, `halveTotal`.
  - Round games (Shanghai, Baseball, Golf, Around the Clock, Bob's 27, Count-Up, Hammer Cricket): `RG`, `rgDart`, `rgEndTurn`, `finishRG`.
  - Checkout practice (Practice tab), from Ryan's videos: `CO`/`isCO`, typed visits via `coVisit`, darts-used prompt `coAsk` → `coFinish`, `coAttemptEnd`, `coNext`; board `renderCOBoard`, keypad `renderCODock`; turn log `k:"co"`.
    - 121 Ladder (`c121`): start 121, 9 darts per attempt, double out. Finish = up one, miss = down one (skipping the bogey numbers 159/162/163/165/166/168/169), never below the banker (a number finished in ≤3 darts) or 121. No attempt limit: a player is done after checking out 170; the game ends when everyone is done or someone taps End game (`coEnd`, counts as finished). Score = highest number checked out. Not head-to-head: solo, or with 2+ players everyone forms one team (`members`, `match.teams`) sharing one ladder, one visit each in turn, starting with the chosen first thrower (no bull-off); partners get their own checkout stats via `memberStats`.
    - Catch 40 (`catch40`): 61→100, 6 darts each; finish in 2 darts = 3 pts, 3 = 2, 4–6 = 1. Max 120.
  - Medley (501/Cricket legs, bull-off decider): `match.base==="medley"` and `match.game` = the current leg's game, `medleyKind`, `corkWinner`, `corkGame`.
- Turn log for stats and recaps: `tl({...})` → `match.tlog`. Stats: `playerStats`, `buildRecord`. Recap email/HTML: `reportHtml`.
- Online play: `hostOnline`, `lookupGame`, `confirmJoin`, `pushState`, `listen`, `isMyTurn`, `claims`.
- Accounts and sessions: `startAuth`, `people()`, `deliver()` (saves history + sends emails), `endSession`.

## Ryan's preferences (already implemented)
- Turns never end on their own after the 3rd dart. The player taps END TURN. A 4th dart is blocked. Exceptions: a winning dart, or a player knocked out mid-turn in Killer.
- Who throws first is chosen at setup and on Rematch (a player, a bull-off, or random).
- The app is used on a wall-mounted tablet next to the board, so key info must be readable from the oche: big target banner in round games, big cream cricket marks.
- Settings screen (`renderSettings`, gear button on the main screen) holds the colour scheme: `THEMES` presets or custom colours, saved per device in localStorage (`dartsScorer.theme`), applied by `applyTheme()` which derives every CSS variable from main/highlight/background. Device preferences live in `prefs` (`dartsScorer.prefs`, defaults in `PREF_DEF`): `wake` (Wake Lock), `caller` off/big/all plus `voice` (voiceURI), `rate`, `pitch` (speechSynthesis via `callerCheck()` diffing `match.tlog` on render, so online opponents hear calls too), `textSize` (`--ts` CSS multiplier), `hints`, `ddAsk`, `sound`/`vibrate` (`tapFeedback`), `quick` (10 quick-score buttons, `qs(i)`), `startWith` + `defaults` (setup applied on launch). Add future settings there.
- Default colour scheme matches the app icon (CSS variables in `:root`): purple `--accent` (neon ring/darts) for UI, cream `--gold` (sisal) for highlights, board red/green for triples, doubles, MISS and busts.

## Unfinished matches
- "End match" (resume card on home/setup, and the in-game menu) opens `dialog="abandon"`: save stats so far or discard. `abandonMatch(keep)` adds a partial `buildRecord` to the local session (title "(not finished)", `rec.unfinished`, raws `unfinished`, nobody wins) and clears the match. Ending a session with a match in progress offers include/discard (`endKeep`). Careers count unfinished darts/averages but not matches played/won or per-game played.

## Teams (local games only for now)
- Setup: `settings.teams` ("0", "2"-"4") and `settings.teamOf` (team per player); `teamsOn()`, `teamGroups()`. Not for Killer or Bob's 27 (`teamable`). Hosting online is disabled while teams are on.
- Engine: each side is one entry in `match.players` with `members` [{name,pid}]; `match.teams` true. Partners alternate A1, B1, A2, B2: `upIdx(side)` = (side's turns this leg `match.leg.tc` + legs played) % members; `nextPlayer()` bumps `tc`. `whoName()` = who is throwing. `tl()` tags turn entries with `w` (partner index).
- Stats: `buildRecord` keeps `players` = teams (team stats) and adds `members` = each partner's own stats (`memberStats`, from their own turns; team legs count for both). `deliver()` saves history/emails per member; careers count `teamGames`/`teamWins`. Recap shows teams, then each partner, and the thrower's first name on each turn (`turnName`).

## Ryan's house rules (already implemented)
- Killer:
  - Throw for numbers (1–20 or Bull). Hits build lives; going over the max = out.
  - Exactly max = killer. A killer hitting their own number = out. Below 0 = out.
  - No attacking players who haven't had their first turn.
  - Killer is a single game with no sets or legs.
- Halve-It: 20, Even, 19, Odd, 18, Triple, 17, Double, 16, Choice, 15, Bull. Halving rounds **up**. Even/Odd use total entry.
- Hammer Cricket: 20, 19, 18, Wild, 17, 16, 15, Wild. Darts score ×1/×2/×3 by throw order (final round ×1/×3/×5); a full miss costs 3× the number. Open or Masters.
- Medley: legs alternate 501 then Cricket; on the final leg the bull-off winner picks the game and throws first.

## Planned next: Autodarts auto-scoring (steel-tip)
Build it as a separate "bridge" page that joins an online game by code and only sends darts (segment + multiplier)
into the existing engine, so every game and rule automatically works with auto-scoring.
The connection to Autodarts is unofficial (community tools read its throw data), so check how before building.

## Parked: live video in online matches (Ryan wants this later)
Plan agreed on 2026-11-10, not started:
1. WebRTC video between players in online games, signalling through the existing Firebase game node. Small video window above the scoreboard, plus a front/rear camera flip button. Also *try* opening both cameras at once, falling back to one if the phone refuses (most Android Chrome builds won't allow two cameras at the same time).
2. A "camera only" join mode so a second phone or tablet can stream the board.
3. If peers can't connect on mobile data, add a free TURN relay (for example Cloudflare). Start with STUN only.
Needs real two-phone testing, so wait until Ryan has time.

## Working with Ryan
He's on an Android phone (Samsung Fold). Keep steps phone-friendly and test changes before pushing.
