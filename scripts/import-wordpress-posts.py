"""One-off import of the old WordPress blog into src/content/posts.

Usage: python3 scripts/import-wordpress-posts.py <folder of downloaded post HTML> <post-sitemap.xml>

- Keeps each post at its old URL (/<slug>/) via the file name.
- Title = the on-page heading; metaTitle = the old <title> (SEO title); description = old meta description.
- Converts the article body to Markdown, downloads its images to src/images/blog/ with descriptive names.
- Rewrites links to old service pages to their new equivalents.
"""
import json, os, re, sys, urllib.request, html as H
from datetime import datetime
from bs4 import BeautifulSoup
from markdownify import markdownify

SRC, SITEMAP = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "src/content/posts")
IMG_DIR = os.path.join(ROOT, "src/images/blog")
os.makedirs(IMG_DIR, exist_ok=True)
DOMAIN = "https://carpetcleaningprofessionals.co.uk"

# Old service URLs → new pages
LINK_MAP = {
    "/carpet-cleaning-services/": "/services/",
    "/carpet-cleaning/": "/services/carpet-cleaning/",
    "/professional-carpet-cleaning-near-me/": "/services/carpet-cleaning/",
    "/rug-cleaning/": "/services/rug-cleaning/",
    "/professional-sofa-cleaning/": "/services/upholstery-cleaning/",
    "/upholstery-cleaning-near-me/": "/services/upholstery-cleaning/",
    "/upholstery-cleaning/": "/services/upholstery-cleaning/",
    "/commercial-carpet-cleaning/": "/services/commercial-carpet-cleaning/",
    "/pet-odour-and-urine-treatments/": "/services/stain-odour-removal/",
    "/end-of-tenancy-carpet-cleaning/": "/services/end-of-tenancy-carpet-cleaning/",
    "/how-much-is-carpet-cleaning/": "/contact/",       # old prices page
    "/carpet-moth-treatment/": "/services/carpet-moth-treatment/",
    "/flea-treatment/": "/services/flea-treatment/",
    "/mattress-cleaning-services/": "/services/mattress-cleaning/",
    "/mattress-cleaning/": "/services/mattress-cleaning/",
}

lastmod = dict(re.findall(r"<loc>%s/([^<]*?)/?</loc>\s*<lastmod>([^<]+)</lastmod>" % re.escape(DOMAIN),
                          open(SITEMAP).read()))
J = json.dumps
GENERIC = re.compile(r"^(img|image|dsc|pexels|unsplash|screenshot|photo|wp|whatsapp|untitled|\d)", re.I)


def slugify(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def fetch_image(url, name):
    if "googleusercontent.com" in url:  # temporary Google Docs links – not kept
        return None
    url = url.split("?")[0]
    ext = os.path.splitext(url)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        return None
    dest = os.path.join(IMG_DIR, name + (".jpg" if ext == ".jpeg" else ext))
    if not os.path.exists(dest):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "site-migration"})
            with urllib.request.urlopen(req, timeout=30) as r:
                open(dest, "wb").write(r.read())
        except Exception as e:
            print("  image failed:", url, e)
            return None
    return "/images/blog/" + os.path.basename(dest)


def image_name(url, slug, n, used):
    base = slugify(os.path.splitext(os.path.basename(url.split("?")[0]))[0])
    base = re.sub(r"-\d+x\d+$", "", base)  # strip WordPress size suffix
    base = re.sub(r"-(scaled|e\d+)$", "", base)
    if not base or GENERIC.match(base) or len(base) < 8:
        base = f"{slug}-{n}"
    name, k = base, 2
    while name in used:
        name, k = f"{base}-{k}", k + 1
    used.add(name)
    return name


def rewrite_link(href):
    if not href:
        return href
    href = re.sub(r'(%22|["\'])+/?$', "", href.strip())  # stray quotes from the old editor
    if href.startswith(DOMAIN):
        href = href[len(DOMAIN):] or "/"
    if href.startswith("/"):
        path = href.split("#")[0].split("?")[0]
        if not path.endswith("/") and "." not in path.rsplit("/", 1)[-1]:
            path += "/"
        if path.lower().startswith("/carpet-cleaning-"):
            path = path.lower()  # WordPress matched these case-insensitively; static hosting doesn't
            if path == "/carpet-cleaning-walthamforest/":
                path = "/carpet-cleaning-london/"
        return LINK_MAP.get(path, path)
    return href


report = {"posts": 0, "images": 0, "missing_alt": [], "unmapped_links": {}}
used_names = set()

for f in sorted(os.listdir(SRC)):
    slug = f[:-5]
    s = BeautifulSoup(open(os.path.join(SRC, f), encoding="utf-8", errors="ignore"), "html.parser")
    meta = lambda **kw: (s.find("meta", attrs=kw) or {}).get("content")
    seo_title = H.unescape(s.title.get_text()).strip() if s.title else None
    desc = meta(name="description")
    og_img, og_alt = meta(property="og:image"), meta(property="og:image:alt")

    box = s.find(attrs={"data-elementor-type": "wp-post"})
    page_h1 = None
    if box is None:  # older theme template
        for t in s(["script", "style", "header", "footer", "form"]):
            t.decompose()
        for t in s.find_all(attrs={"data-elementor-type": True}):
            t.decompose()
        h1 = s.find("h1")
        page_h1 = h1.get_text(" ", strip=True) if h1 else seo_title
        box = s.select_one(".entry-content")
        if box is None and h1 is not None:
            box = h1.parent
            while box and len(box.find_all("p")) < 3:
                box = box.parent
        if h1 is not None and box is not None and box.find("h1") is None and h1 in box.parents:
            pass

    title, date = None, None
    for w in box.select("[data-widget_type]"):
        wt = w["data-widget_type"]
        if wt.startswith("post-info"):
            m = re.search(r"([A-Z][a-z]+ \d{1,2}, \d{4})", w.get_text(" "))
            if m:
                date = datetime.strptime(m.group(1), "%B %d, %Y").date().isoformat()
            w.decompose()
        elif wt.startswith(("table-of-contents", "share-buttons", "post-navigation", "button", "form", "social")):
            w.decompose()
    for t in box(["script", "style", "form", "noscript", "iframe", "button"]):
        t.decompose()

    # Title: the on-page heading
    h = box.find("h1") or (None if page_h1 else box.find(["h2", "h3"]))
    if h is not None:
        title = h.get_text(" ", strip=True)
        h.decompose()
    title = title or page_h1 or seo_title
    date = date or (lastmod.get(slug, "")[:10]) or "2021-01-01"

    # Featured image = og:image; drop the same image from the body
    used = set()
    image, image_alt = None, None
    if og_img:
        image = fetch_image(og_img, image_name(og_img, slug, 0, used_names))
        image_alt = og_alt or title
        if not og_alt:
            report["missing_alt"].append(f"{slug} (featured)")
        stem = re.sub(r"-\d+x\d+$", "", os.path.splitext(os.path.basename(og_img))[0])
        for img in box.find_all("img"):
            if stem in (img.get("data-lzl-src") or img.get("data-src") or img.get("src") or ""):
                (img.find_parent("figure") or img).decompose()
                break

    n = 1
    for img in box.find_all("img"):
        src = img.get("data-lzl-src") or img.get("data-src") or img.get("data-lazy-src") or img.get("src") or ""
        if src.startswith("data:") or not src:
            img.decompose()
            continue
        if src.startswith("/"):
            src = DOMAIN + src
        local = fetch_image(src, image_name(src, slug, n, used_names))
        n += 1
        if not local:
            img.decompose()
            continue
        alt = (img.get("alt") or "").strip()
        if not alt:
            alt = title
            report["missing_alt"].append(slug)
        img.attrs = {"src": local, "alt": alt}
        report["images"] += 1

    for a in box.find_all("a"):
        new = rewrite_link(a.get("href"))
        if new and new.startswith("/") and not new.startswith(("/services/", "/contact/", "/blog/", "/carpet-cleaning-", "/images/")) and new != "/":
            report["unmapped_links"][new] = report["unmapped_links"].get(new, 0) + 1
        a.attrs = {"href": new} if new else {}

    for t in box.find_all("h1"):
        t.name = "h2"

    md = markdownify(str(box), heading_style="ATX", bullets="-", strip=["span", "div", "section", "article", "figure", "figcaption"])
    md = re.sub(r"[ \t]+\n", "\n", md)
    md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
    md = re.sub(r"^(#+)\s*\*\*(.+?)\*\*\s*$", r"\1 \2", md, flags=re.M)  # bold inside headings

    fm = ["---", f"title: {J(title)}"]
    if seo_title and seo_title != title:
        fm.append(f"metaTitle: {J(seo_title)}")
    fm.append(f"description: {J(desc or '')}")
    fm.append(f"date: {date}")
    if image:
        fm += [f"image: {J(image)}", f"imageAlt: {J(image_alt)}"]
    fm += ["---", ""]
    open(os.path.join(OUT, f"{date}-{slug}.md"), "w").write("\n".join(fm) + md)
    report["posts"] += 1

print(json.dumps({k: (v if not isinstance(v, list) else len(v)) for k, v in report.items() if k != "unmapped_links"}))
print("unmapped internal links:", dict(sorted(report["unmapped_links"].items(), key=lambda x: -x[1])))
