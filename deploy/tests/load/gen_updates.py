"""Pre-generates the Yjs messages the k6 load test sends.

k6's JavaScript runtime can't run Yjs, so this builds real Yjs updates with pycrdt.

Every document starts from the same seed: SEED_BLOCKS paragraph blocks. Each simulated user then types
into one of those blocks, appending a 13-digit placeholder per edit, the way people type into existing
text rather than adding blocks. k6 overwrites the placeholder with the current time just before
sending, and receivers read it back to measure fan-out latency. Each user's document has its own client
id, so any number of users can edit the same document without colliding, and a user's updates must be
sent in order, which one socket guarantees.

    python gen_updates.py --users 300 --per-user 100 --out-dir .work
"""

import argparse
import base64
import json
import random
import sys
from pathlib import Path

import pycrdt

PLACEHOLDER = b"9999999999999"
BLOCKS_KEY = "blocks"
SEED_BLOCKS = 8
SEED_CLIENT_ID = 7


def block_text(doc: pycrdt.Doc, index: int) -> pycrdt.Text:
    return doc.get(BLOCKS_KEY, type=pycrdt.Array)[index]["text"]


def build_seed() -> bytes:
    doc = pycrdt.Doc(client_id=SEED_CLIENT_ID)
    blocks = doc.get(BLOCKS_KEY, type=pycrdt.Array)
    with doc.transaction():
        for i in range(SEED_BLOCKS):
            blocks.append(pycrdt.Map({
                "id": f"seed-{i}",
                "type": "paragraph",
                "text": pycrdt.Text(f"Paragraph {chr(65 + i)}: notes typed by the load test. "),
            }))
    return doc.get_update()


def build_user_edits(seed_update: bytes, client_id: int, block_index: int, count: int) -> list[dict]:
    doc = pycrdt.Doc(client_id=client_id)
    doc.apply_update(seed_update)
    text = block_text(doc, block_index)

    updates: list[bytes] = []
    doc.observe(lambda event: updates.append(event.update))

    items = []
    for _ in range(count):
        text.insert(len(text), PLACEHOLDER.decode())
        message = pycrdt.create_update_message(updates[-1])
        if message.count(PLACEHOLDER) != 1:
            sys.exit("placeholder is not unique in the encoded message")
        items.append({"m": base64.b64encode(message).decode(), "o": message.find(PLACEHOLDER)})
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--users", type=int, required=True)
    parser.add_argument("--per-user", type=int, required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    seed_update = build_seed()
    (out / "seed.b64").write_text(base64.b64encode(pycrdt.create_update_message(seed_update)).decode())

    first_client_id = random.randint(1_000_000, 2_000_000_000)
    items = []
    for user in range(args.users):
        items.extend(build_user_edits(seed_update, first_client_id + user, user % SEED_BLOCKS, args.per_user))

    (out / "updates.json").write_text(json.dumps({"per_user": args.per_user, "items": items}))
    print(f"wrote {len(items)} edits for {args.users} users to {out}")


if __name__ == "__main__":
    main()
