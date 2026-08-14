# mathboard
Google Docs for LaTeX
LIVE: https://mathboard-nine.vercel.app/

## Preview
[images]

## Features


## In Progress
- Export as PDF
- Markdown support
- Google Sign-In

## Technical
### Frontend
/
/signin, /signin?redirect={}
/docs
/docs/d/{id}

### Backend
Lock symbol emoji = Protected requiring Authorization Bearer token
/ping
/signin
/me
GET docs/ (add lock emoji to indicate protected)

CREATE /doc/
GET /doc/?id={}
UPDATE /doc/?id={}
DELETE /doc/?id={}

Websockets
...


### Low-Priority Enhancements
- Add decorators to add another layer for function arguments to early return and for organization