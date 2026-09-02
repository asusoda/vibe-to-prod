# Gear Tracker

A little app for tracking who's borrowed the club's equipment. It works —
someone vibecoded it in an afternoon and it's been running ever since.

It also has the kind of problems that afternoon-vibecoded apps always have.
Today you're going to fix them, **using GitHub Copilot Chat**, and the point of
the workshop is *how you ask*. A lazy prompt gets you code that looks fixed. A
good prompt gets you code that is fixed. You'll feel the difference on every
challenge.

---

## Start here

Open a terminal (**Terminal → New Terminal**) and run:

```bash
nvm install 22 && nvm use 22
npm start
```

The first line matters: this app uses Node's built-in `node:sqlite` module, which
needs Node 22.13 or newer. The default Codespaces Node is older, and `npm start`
will fail with `ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite`
until you switch. You only need to do it once per terminal — if you open a new
terminal, run `nvm use 22` again.

A window will pop up offering to open the app in your browser — click it. If you
miss it, open the **Ports** tab, find port 3000, and click the globe icon.

You should see the Gear Tracker page: a weather strip, a login box, and a list
of equipment. Leave this running. When you change the code, stop it with
`Ctrl+C` and run `npm start` again.

**Open Copilot Chat** with the chat icon in the left sidebar (or `Ctrl+Shift+I`).
This is the only tool you'll use to change the code today.

---

## How to check your work

After each challenge, run its checker in the terminal:

```bash
node verify.js 1     # then 2, then 3, then 4
```

It boots the app, pokes at it, and tells you `PASS` or `FAIL` with a reason.
Green means move on.

## Save your work after every challenge

The moment a challenge passes, lock it in:

```bash
git add -A && git commit -m "challenge 1 done"
```

If a later challenge goes sideways and you can't get back to working, this
undoes everything since your last commit:

```bash
git reset --hard HEAD
```

That safety net matters most in Challenge 3, so build the habit early.

---

## The one rule for today

> **"Fix it" and "make no mistakes" are not instructions. They're wishes.**
> A good prompt says *which file*, *which method*, and *what not to break* —
> things Copilot can't guess and you can check.

Each challenge below teaches one piece of that.

---

## Challenge 1 — Point it at the file

The weather widget is hardcoded with a secret configuration value in the source.
That is a real risk, and it should be loaded from a local config source instead.
The starter repository does not include that local file, so you will need to
create it as part of the fix.

There are a few plausible places a vague prompt can send Copilot, so part of your
job is telling it exactly where to look. Don't let it guess.

Try the lazy version first so you see what happens:

> `remove the hardcoded secret`

Then do it properly — name the file, and say where the value should come from.
Copilot can attach a file to your prompt with `#`. The app already has a local
config convention for values like this: create a `.env` file at the repository
root and make the code read from it.

**Done when:** `node verify.js 1` is green — the secret is gone from the source,
the widget still works, and it correctly breaks if the value is missing.

---

## Challenge 2 — Name the method

Try logging in with a username of:

```
' OR '1'='1' --
```

…and literally any password. You're now admin. That's **SQL injection**: the
login glues your input straight into a database query.

Ask Copilot to fix it — but *how* you ask decides whether you get a real fix or a
fake one. A vague prompt often makes Copilot "sanitize" the input by stripping
out dangerous characters. That looks fixed and isn't. The real fix has a name,
and there's more than one injectable query in this file.

Then run `node verify.js 2`. Read what it tells you. Then write a prompt that
**names the technique you want** and doesn't settle for filtering characters.

**Done when:** `node verify.js 2` is green — real logins still work, and neither
the login nor the equipment list can be injected.

---

## Challenge 3 — Give it the destination

Everything is in one file: the HTML page, the styling, the browser JavaScript,
and the server, all jammed into `server.js`. Real projects don't do this. Split
it up.

If you just say "split this into files," Copilot will invent its own structure,
name things whatever it likes, and often leave the app broken with references
pointing at files that don't exist. Don't let it choose — **give it the exact
layout you want:**

- `index.html` — just the page markup
- `public/style.css` — the styles
- `public/app.js` — the browser JavaScript
- `server.js` — the server keeps everything else

Tell it to update every reference so the page still loads its CSS and JS, and
make sure the **server actually sends those new files** to the browser. That
last part is the step it's most likely to skip.

**This is the challenge most likely to break the app.** Commit first
(`git add -A && git commit -m "before split"`) so you have a way back.

**Done when:** `node verify.js 3` is green — no inline `<style>` or `<script>`,
and the app serves the new files so the page looks and works exactly as before.

---

## Challenge 4 — Say what it's not allowed to touch

Add a **delete** capability: a member should be able to remove an item from the
inventory. You'll need a `DELETE /api/items/:id` route on the server and a way to
trigger it from the page.

Here's the thing about letting an AI loose in your code: while it's adding your
feature, it likes to "tidy up" nearby code it wasn't asked to touch — and it can
quietly undo your earlier fixes. So your prompt has to **fence off what must not
change.**

Write a prompt that asks for the delete feature *and* explicitly tells Copilot
not to modify the login or the weather code.

**Done when:** `node verify.js 4` is green — delete works, exactly one item is
removed, **and** challenges 1–3 are all still passing. (Challenge 4's checker
re-runs the earlier ones for you. If one went red, that's the collateral damage
this challenge is about — `git reset --hard HEAD` and try a tighter prompt.)

---