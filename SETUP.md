# Setup

## Environment

```
python3 -m venv venv
source venv/bin/activate
pip install -r src/requirements.txt
```

### .env
PROD=false/true
SECRET_KEY=
DATABASE_URL=

```cd app && npm i```

## Test
`cd app && PORT=12000 npm run dev`
`cd src && python main.py`

App: localhost:12000
API: localhost:12001
