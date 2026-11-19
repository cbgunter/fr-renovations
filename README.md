# First Responder Renovations

Website and admin tools for First Responder Renovations, a firefighter-owned general contractor in Downers Grove, IL.

**Live:** https://renovations.caseyhunter.net · **Admin:** https://renovations.caseyhunter.net/admin

## What's here

| Part | Who | What it does |
|---|---|---|
| Public site | Homeowners | One fast, SEO-ready page: about, the six job types with photos, towns we serve, contact form |
| Today | Owner | What's on the calendar, new leads to call, estimates waiting on an answer |
| Leads | Owner | Every web request and phone call in one list, by status and priority, with the next step for each |
| Estimator | Owner, on site | Six job types, big buttons, live total; send by email or text from the driveway |
| Calendar | Owner | Estimate visits, confirmed jobs and pencilled-in holds; subscribe from your phone's calendar |
| Customer estimate page | Homeowners | Clean, printable estimate with an Approve button |

## For the owner

- **Sign in** at `/admin` with the email you were invited with. You stay signed in on that phone for 90 days. Tip: on iPhone, tap Share → Add to Home Screen so it opens like an app.
- **Set your prices** in Settings → Estimator prices. Until you do, the estimator uses sample numbers and says so.
- **Add website photos** in Settings → Website photos. Take them straight from your phone; they are resized automatically and show up on the site within 5 minutes.
- **Put the calendar on your phone** from Settings → "Add to my phone".
- **Get emailed about new leads** by setting Settings → Alerts.

## Filling in the business details

Open `web/site.config.ts` and replace each `[placeholder]` (owner name, phone, email, street, ZIP, license number, Google Business Profile link). Commit to `main` and the site redeploys. Name, address and phone must match the Google Business Profile exactly.

## Running costs

Everything is pay-per-use on AWS. At about 15 customers a month this is well under $1/month (CloudFront, Lambda, DynamoDB, API Gateway, Cognito Lite and SES are all in free-tier or pennies range; the DNS zone already exists). A $5/month AWS Budget alert watches the `project=fr-renovations` cost tag.

## Development

See [CLAUDE.md](CLAUDE.md) for commands, layout and gotchas.
