# PREVIEW MAP — direct URLs

Start the server:

```bash
python3 .preview/serve.py
```

**`http://127.0.0.1:8790/` opens the customer-facing Mission Residency page.** It no longer opens documentation. The internal QA hub is last on this list, at `/review/`, and is excluded from the Codex deployment payload.

| # | Surface | URL |
|---|---|---|
| **1** | **Mission Residency — the flagship** | **http://127.0.0.1:8790/** |
| 2 | Corporate homepage, seasonal layer | http://127.0.0.1:8790/home |
| 3 | IV Prep Complete | http://127.0.0.1:8790/complete |
| 4 | IV Prep Essentials | http://127.0.0.1:8790/essentials |
| 5 | 360 Match Mentorship | http://127.0.0.1:8790/360 |
| 6 | Personal Statement Intensive | http://127.0.0.1:8790/ps |
| 7 | Compare programs | http://127.0.0.1:8790/compare |
| 8 | Ways to pay | http://127.0.0.1:8790/payment |
| 9 | The September 8 state | http://127.0.0.1:8790/sept8 |
| 10 | Internal QA hub — **not a customer page** | http://127.0.0.1:8790/review |

Also: `/faq` jumps to the FAQ, and **`/truth`** shows the true pre-launch state (every CTA closed, because `verified_live_at` is still null).

## Why the customer URLs default to Fall Access Week

The production truth gate refuses to show Fall Access pricing until the campaign is verified live, and `verified_live_at` is `null`. Left alone, every customer URL would show "enrollment closed" — technically correct, but useless for judging the selling experience.

So the **preview aliases** append `?state=A`, which shows what a prospect would see during Fall Access Week. The floating toolbar says **"Preview · simulated"** so this is never mistaken for production, and `/truth` shows the real state.

**The production gate itself is untouched.** In production, with `verified_live_at` null, the site still cannot show Fall Access pricing. This is a preview alias, not a change to the rule.

## The toolbar

Bottom-right, one line: a state selector, a link to the review notes, and a dismiss button. It is deliberately outside the production page design and is removed at productionization. Dismissing it sticks for the browser session.
