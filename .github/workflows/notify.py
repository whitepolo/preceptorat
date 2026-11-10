"""Poste un réveil au précepteur. N'écrit jamais les secrets dans les journaux."""

import json
import os
import sys
import urllib.error
import urllib.request

LESSON_ID = __import__("re").compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z]+-L[0-9]+$")


def is_tutor(body: str) -> bool:
    return bool(body) and body.lstrip().startswith("<!-- schopen -->")


def lesson_id(issue: dict) -> str | None:
    title = (issue.get("title") or "").strip()
    labels = []
    for label in issue.get("labels") or []:
        labels.append(label.get("name") if isinstance(label, dict) else str(label))
    if "dialogue" in labels:
        return None
    if LESSON_ID.match(title):
        return title
    return None


def main() -> int:
    url = os.environ.get("WEBHOOK_URL", "")
    auth = os.environ.get("WEBHOOK_AUTH", "")
    if not url or not auth:
        print("Secrets absents : notification ignorée.")
        return 0

    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    event_path = os.environ.get("GITHUB_EVENT_PATH", "")
    with open(event_path, encoding="utf-8") as handle:
        event = json.load(handle)

    if event_name == "issue_comment":
        comment = event.get("comment") or {}
        issue = event.get("issue") or {}
        if is_tutor(comment.get("body") or ""):
            print("Réponse du précepteur : pas de notification.")
            return 0
        payload = {
            "issue_number": issue.get("number"),
            "comment_id": comment.get("id"),
            "kind": "comment",
            "lesson_id": lesson_id(issue),
            "url": comment.get("html_url") or issue.get("html_url"),
        }
    elif event_name == "issues":
        issue = event.get("issue") or {}
        if is_tutor(issue.get("body") or ""):
            print("Message du précepteur : pas de notification.")
            return 0
        payload = {
            "issue_number": issue.get("number"),
            "comment_id": None,
            "kind": "opened",
            "lesson_id": lesson_id(issue),
            "url": issue.get("html_url"),
        }
    else:
        print("Événement ignoré.")
        return 0

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": auth,
            "Content-Type": "application/json",
            "User-Agent": "preceptorat-webhook",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            print(f"Notification envoyée ({response.status}).")
            return 0
    except urllib.error.HTTPError as error:
        print(f"Échec de la notification (code {error.code}).")
        return 1
    except Exception:
        print("Échec de la notification.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
