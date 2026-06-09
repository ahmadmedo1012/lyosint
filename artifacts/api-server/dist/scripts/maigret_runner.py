#!/usr/bin/env python3
"""
Maigret runner for LYOSINT
Reads a JSON config from stdin, runs Maigret, and writes a JSON result to stdout.

Input (stdin):
  {
    "username": "github",
    "timeout": 10,
    "max_connections": 20,
    "max_sites": 500,           // 0 = no limit
    "priority_sites": ["Twitter","Facebook","Instagram", ...]  // always included
  }

Output (stdout):
  {
    "username": "github",
    "found": [
      {
        "site": "YouTube",
        "url": "https://youtube.com/@github",
        "category": "social",
        "httpStatus": 200,
        "detectionMethod": "maigret",
        "fullname": "GitHub",
        "bio": "...",
        "image": "https://...",
        "extra": {...}
      }
    ],
    "totalFound": N,
    "elapsedSeconds": 12.3,
    "sitesChecked": 487,
    "priorityHits": 4
  }

Errors are written to stderr in a single JSON line:
  {"error": "message"}
"""
import asyncio
import json
import logging
import os
import sys
import time

# Quiet maigret progress bar — redirect stderr to /dev/null at the file descriptor level
# (maigret writes progress via a custom stream that bypasses Python's logging)
_DEVNULL = os.open(os.devnull, os.O_WRONLY)
os.dup2(_DEVNULL, 2)  # stderr
os.close(_DEVNULL)


# Major social media sites — Maigret ranks these LOW (3120+) because they need
# login to detect. We force-include them so the search always tries them.
DEFAULT_PRIORITY_SITES = [
    "Twitter", "X", "Facebook", "Instagram", "LinkedIn", "YouTube", "TikTok",
    "Reddit", "Pinterest", "Snapchat", "Tumblr", "Twitch", "Discord", "Telegram",
    "WhatsApp", "Mastodon", "Threads", "Bluesky", "VK", "Weibo", "QQ", "WeChat",
    "Gravatar", "GitHub", "GitLab", "Bitbucket", "StackOverflow", "Medium",
    "Substack", "Blogger", "WordPress", "Telegram", "Flickr", "Vimeo",
    "SoundCloud", "Bandcamp", "DeviantArt", "Behance", "Dribbble", "Figma",
    "About.me", "Wattpad", "Quora",
]


async def run_maigret(
    username: str,
    timeout: int = 10,
    max_connections: int = 20,
    max_sites: int = 500,
    priority_sites: list = None,
):
    import maigret
    from maigret import MaigretDatabase
    from maigret.checking import maigret as maigret_search

    pkg_dir = os.path.dirname(maigret.__file__)
    data_path = os.path.join(pkg_dir, "resources", "data.json")

    db = MaigretDatabase()
    db.load_from_path(data_path)

    sites_dict = dict(db.sites_dict)  # copy to avoid mutating db

    if priority_sites is None:
        priority_sites = DEFAULT_PRIORITY_SITES

    # Remove priority sites from the bulk pool so they aren't double-counted
    priority_kept = {}
    for s in priority_sites:
        if s in sites_dict:
            priority_kept[s] = sites_dict.pop(s)

    # Cap the bulk pool at max_sites
    if max_sites > 0 and len(sites_dict) > max_sites:
        try:
            ranked = db.ranked_sites_dict(username) if hasattr(db, "ranked_sites_dict") else None
            if ranked:
                # Filter ranked to only include sites in our pool, preserve order
                ranked_pool = [(k, v) for k, v in ranked.items() if k in sites_dict]
                if len(ranked_pool) > max_sites:
                    sites_dict = dict(ranked_pool[:max_sites])
                else:
                    sites_dict = dict(ranked_pool)
            else:
                # Truncate alphabetically
                sites_dict = dict(list(sites_dict.items())[:max_sites])
        except Exception:
            sites_dict = dict(list(sites_dict.items())[:max_sites])

    # Re-add priority sites at the END (Maigret will still check them, but they
    # get full budget since they are explicitly requested)
    sites_dict.update(priority_kept)

    sites_checked = len(sites_dict)
    priority_site_names = set(priority_kept.keys())

    # Quiet logger
    logger = logging.getLogger("maigret")
    logger.setLevel(logging.CRITICAL)
    for h in list(logger.handlers):
        logger.removeHandler(h)
    logger.addHandler(logging.NullHandler())

    for name in list(logging.root.manager.loggerDict.keys()):
        if name.startswith("maigret"):
            l = logging.getLogger(name)
            l.setLevel(logging.CRITICAL)
            for h in list(l.handlers):
                l.removeHandler(h)
            l.addHandler(logging.NullHandler())
            l.propagate = False

    start = time.time()
    raw = await maigret_search(
        username,
        sites_dict,
        logger,
        no_progressbar=True,
        timeout=timeout,
        max_connections=max_connections,
        is_parsing_enabled=True,
    )
    elapsed = time.time() - start

    # Build clean results
    found = []
    priority_hits = 0
    for site_name, r in raw.items():
        status = r.get("status")
        status_name = status.name if hasattr(status, "name") else str(status)
        if status_name != "Claimed":
            continue

        checker = r.get("checker")
        resolved_url = getattr(checker, "url", None) if checker else None
        http_status = None
        if checker and hasattr(checker, "response_status"):
            http_status = checker.response_status

        site = db.sites_dict.get(site_name)
        category = "unknown"
        if site and hasattr(site, "tags") and site.tags:
            category = ",".join(site.tags)

        is_priority = site_name in priority_site_names
        if is_priority:
            priority_hits += 1

        site_dict = {
            "site": site_name,
            "url": resolved_url or r.get("url_main"),
            "category": category,
            "httpStatus": http_status,
            "detectionMethod": "maigret",
            "fullname": None,
            "bio": None,
            "image": None,
            "extra": {},
            "isPriority": is_priority,
        }
        if checker:
            for attr in ("ids_data", "parsed_data", "metadata", "profile"):
                if hasattr(checker, attr):
                    data = getattr(checker, attr)
                    if isinstance(data, dict):
                        for k, v in data.items():
                            if not isinstance(v, (str, int, float, bool)):
                                continue
                            kl = k.lower()
                            if kl in ("image", "avatar", "profile_pic", "profile_image", "photo", "picture", "img"):
                                if not site_dict["image"]:
                                    site_dict["image"] = str(v)
                            elif kl in ("fullname", "full_name", "displayname", "display_name", "name"):
                                if not site_dict["fullname"]:
                                    site_dict["fullname"] = str(v)
                            elif kl in ("bio", "about", "description", "tagline"):
                                if not site_dict["bio"]:
                                    site_dict["bio"] = str(v)
                            else:
                                if len(site_dict["extra"]) < 20:
                                    site_dict["extra"][k] = str(v)[:500]
        found.append(site_dict)

    # Sort: priority hits first, then by site name
    found.sort(key=lambda x: (0 if x.get("isPriority") else 1, x["site"].lower()))

    return {
        "username": username,
        "found": found,
        "totalFound": len(found),
        "elapsedSeconds": round(elapsed, 2),
        "sitesChecked": sites_checked,
        "priorityHits": priority_hits,
    }


def main():
    try:
        raw = sys.stdin.read()
        cfg = json.loads(raw) if raw.strip() else {}
    except Exception as e:
        sys.stdout.write(json.dumps({"error": f"invalid stdin: {e}"}))
        return 1

    username = cfg.get("username", "").strip()
    if not username:
        sys.stdout.write(json.dumps({"error": "username required"}))
        return 1

    try:
        result = asyncio.run(run_maigret(
            username=username,
            timeout=int(cfg.get("timeout", 10)),
            max_connections=int(cfg.get("max_connections", 20)),
            max_sites=int(cfg.get("max_sites", 500)),
            priority_sites=cfg.get("priority_sites"),
        ))
        sys.stdout.write(json.dumps(result))
        return 0
    except Exception as e:
        sys.stdout.write(json.dumps({"error": f"maigret_failed: {e}"}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
