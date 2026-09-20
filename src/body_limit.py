"""Caps how large an HTTP request body may be, so one request can't make the server buffer megabytes of JSON.

Documents are edited over the WebSocket, not through these endpoints, so every JSON body here is small: titles, ids, credentials. Images travel inside document updates on the socket and have their own cap in liveshare/routes.py.
"""

import json

MAX_BODY_BYTES = 1024 * 1024


class BodyLimitMiddleware:
    """Plain ASGI middleware. Refuses on the declared Content-Length when there is one, and counts the bytes actually received otherwise (chunked uploads have no length up front)."""

    def __init__(self, app, max_bytes: int = MAX_BODY_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            await self._refuse(send)
            return

        received = 0
        response_started = False
        refused = False

        async def limited_receive():
            # FastAPI turns any exception raised while it reads the body into a 400, so the 413 is sent from here and the app is told the client went away.
            nonlocal received, refused
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    if not response_started and not refused:
                        refused = True
                        await self._refuse(send)
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message):
            nonlocal response_started
            if refused:
                return
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        await self.app(scope, limited_receive, guarded_send)

    async def _refuse(self, send):
        body = json.dumps({"detail": "Request body too large"}).encode()
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        })
        await send({"type": "http.response.body", "body": body})
