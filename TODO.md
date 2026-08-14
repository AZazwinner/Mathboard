NO LONGER USED: Was for initial full-stack setup which no longer applies

Backend:
- [x] auth (db)
  - [x] db schema/model
  - [x] crud.py + its services
  - [x] access_token
- [x] user (db)
  - [x] db schema/model
  - [x] crud.py + its services for user
  - [x] crud endpoints in routes.py
  - [x] /me - token

- [x] docs
  - [x] db schema/model
  - [x] CRUD API for /doc
  - [x] ability to share docs
  - [x] GET /docs

- [x] liveshare
  - [x] share edits via websockets naively (full doc)
  - [x] Operation Transform
  - [x] turn into blocks of text
  - [x] support latex

- [x] doc
  - [ ] supports regular markdown
    - [ ] bold/italicize/underline
    - [ ] headers
    - [ ] ` code blocks
    - [ ] ``` code blocks

- [x] latex
  - [x] simple inline render
  - [x] simple multiline render
  - [x] caching for doc?

Frontend:
- [ ] /
  - [ ] simple with call to action -> /signin redirects to /docs
  - [ ] Reformat to mimic modern polished look w/ empty image slots for previews
  - [ ] Take preview images (gifs?)
- [x] /signin
  - [x] create account card
  - [x] signin card
  - [x] uses url params to handle redirects after successful signin
- [ ] /docs
  - [x] placeholder simple list of id
  - [ ] various templates to encourage diverse user experience
  - [x] tables to show documents I own/shared with me
- [x] /docs/d/{id}
  - [x] Basic text editor w/o LaTeX
  - [x] Optimisitic UI synchronization w WS

Hosting:
- [x] Host on free public domain (Next.js on Vercel, FastAPI + PostgreSQL on Railway)

Safeguards:
- [ ] Ensure document max-size exists and enforced to prevent abuse

Test:
- [ ] Go through decision-tree style all possible frontend/backend interactions to ensure every case has been accounted for
Make a /test (maybe python unittest?) for frontend/backend to mimic real working env
