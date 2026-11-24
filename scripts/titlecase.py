"""Title case for headings and titles.

Rules:
1. Always capitalise the first and last word.
2. Capitalise important words (nouns, verbs, adjectives, adverbs, pronouns).
   Articles, coordinating conjunctions and short prepositions stay lowercase.
3. Capitalise the first word after a colon (or " | ") that begins a subtitle.
Place names that already contain capitals (e.g. Weston-super-Mare) are left alone.
"""
import re, sys, glob

MINOR = {"a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet", "as", "at", "by", "in",
         "of", "off", "on", "per", "to", "up", "via", "with", "from", "into", "onto", "over", "upon", "vs"}
PUNCT = "\"'“”‘’()[]?!.,:;"

def cap(w):
    return w[:1].upper() + w[1:] if w else w

def title_case(s):
    tokens = re.split(r"(\s+)", s)
    idx = [i for i, t in enumerate(tokens) if t.strip()]
    out = list(tokens)
    start_next = True
    for n, i in enumerate(idx):
        tok = tokens[i]
        m = re.match(r"^([%s]*)(.*?)([%s]*)$" % (re.escape(PUNCT), re.escape(PUNCT)), tok)
        pre, core, post = m.groups()
        forced = start_next or n == len(idx) - 1
        start_next = post.endswith(":") or tok in ("|", "–", "—")
        if not core or not core[0].isalpha() or core.isupper() and len(core) > 1:
            continue  # numbers, symbols, acronyms
        if "-" in core:
            parts = core.split("-")
            if any(p[:1].isupper() for p in parts[1:]):
                core = cap(core)  # already a proper name, e.g. Weston-super-Mare
            else:
                core = "-".join(cap(p) if (k == 0 or p.lower() not in MINOR) else p.lower() for k, p in enumerate(parts))
                if forced:
                    core = cap(core)
        elif core.lower() in MINOR and not forced:
            core = core.lower()
        else:
            core = cap(core)
        out[i] = pre + core + post
    return "".join(out)

FM_KEYS = ("title", "metaTitle", "heading", "featuresHeading")

def process_md(path):
    text = open(path).read()
    if not text.startswith("---\n"):
        return False
    end = text.index("\n---\n", 4)
    fm, body = text[:end], text[end:]
    def fm_line(m):
        key, q, val = m.group(1), m.group(2), m.group(3)
        if q == '"':
            val = val.replace('\\"', '"')
            return f'{key}: "{title_case(val).replace(chr(34), chr(92) + chr(34))}"'
        return f"{key}: {title_case(val)}"
    keys = "|".join(FM_KEYS)
    fm = re.sub(r'^((?:%s)|  - title): (")(.*)"$' % keys, fm_line, fm, flags=re.M)
    fm = re.sub(r'^((?:%s)|  - title): ()([^"\n].*)$' % keys, fm_line, fm, flags=re.M)
    body = re.sub(r"^(#{1,6} )(.+)$", lambda m: m.group(1) + title_case(m.group(2)), body, flags=re.M)
    new = fm + body
    if new != text:
        open(path, "w").write(new)
        return True
    return False

if __name__ == "__main__":
    if sys.argv[1:2] == ["--test"]:
        for s in sys.argv[2:]:
            print(title_case(s))
    else:
        changed = [p for p in sorted(glob.glob("src/content/**/*.md", recursive=True)) + ["src/404.md"] if process_md(p)]
        print(len(changed), "files updated")
