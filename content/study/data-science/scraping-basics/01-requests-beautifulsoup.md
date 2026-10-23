---
id: ee8c8767-08f8-7756-aafe-5ed19d9fec4a
key: topic:data-science/scraping-basics
subject: data-science
topic: scraping-basics
title: requests & BeautifulSoup
slug: requests-beautifulsoup
order: 1
---

Web scraping = download a page's HTML (`requests`), then pick out the data you need (`BeautifulSoup`). It's how you build datasets that don't come as a CSV.

1. <strong>Request</strong>

   `requests.get(url, headers=…)` downloads the page.

2. <strong>Parse</strong>

   `BeautifulSoup(html, "html.parser")` turns HTML text into a searchable tree.

3. <strong>Extract</strong>

   `find` / `find_all` / `select` locate elements; `.text` and `.get("href")` read them.

4. <strong>Store</strong>

   Collect rows in a list, then save with pandas (`to_csv`).

# 1. Download the page

```python filename:Python
import requests

headers = {"User-Agent": "Mozilla/5.0 (compatible; LearnViaNotesBot/1.0)"}
r = requests.get("https://quotes.toscrape.com/page/1/", headers=headers, timeout=10)
print(r.status_code)          # 200 means OK; 404 not found, 403 forbidden, 429 too many requests
html = r.text                 # decoded text (r.content is the raw bytes)
```

> [!NOTE] Key point
>
> Some sites reject requests without a browser-like `User-Agent` header — that's why the notebook sets one. Always pass a `timeout` so a slow site can't hang your script.

# 2. Parse and extract

```python filename:Python
html = """
<div class="quote">
  <span class="text">“The world as we have created it is a process of our thinking.”</span>
  <small class="author">Albert Einstein</small> <a href="/author/Albert-Einstein">(about)</a>
  <a class="tag" href="/tag/change/">change</a> <a class="tag" href="/tag/thinking/">thinking</a>
</div>
<div class="quote">
  <span class="text">“It is our choices that show what we truly are.”</span>
  <small class="author">J.K. Rowling</small> <a href="/author/J-K-Rowling">(about)</a>
  <a class="tag" href="/tag/choices/">choices</a>
</div>
"""

from bs4 import BeautifulSoup
soup = BeautifulSoup(html, "html.parser")

first = soup.find("div", class_="quote")                      # first match (or None)
print(first.find("small", class_="author").text)              # Albert Einstein

for q in soup.find_all("div", class_="quote"):                # every match
    text = q.find("span", class_="text").text.strip("“”")
    tags = [t.text for t in q.find_all("a", class_="tag")]
    print(text[:22], "|", ", ".join(tags))
```

```filename:Output
Albert Einstein
The world as we have c | change, thinking
It is our choices that | choices
```

| Call | Returns |
| --- | --- |
| `soup.find(tag, class_=…)` | The first matching element, or `None` |
| `soup.find_all(tag, attrs={…})` | A list of all matches |
| `soup.select("div.quote span.text")` | Matches for a CSS selector |
| `el.text` / `el.get_text(strip=True)` | The element's text |
| `el.get("href")` / `el["href"]` | An attribute (`get` returns `None` if missing) |

```python filename:Python
html = """
<div class="quote">
  <span class="text">“The world as we have created it is a process of our thinking.”</span>
  <small class="author">Albert Einstein</small> <a href="/author/Albert-Einstein">(about)</a>
  <a class="tag" href="/tag/change/">change</a> <a class="tag" href="/tag/thinking/">thinking</a>
</div>
<div class="quote">
  <span class="text">“It is our choices that show what we truly are.”</span>
  <small class="author">J.K. Rowling</small> <a href="/author/J-K-Rowling">(about)</a>
  <a class="tag" href="/tag/choices/">choices</a>
</div>
"""

from bs4 import BeautifulSoup
soup = BeautifulSoup(html, "html.parser")
print([a.get("href") for a in soup.select("div.quote > a:not(.tag)")])   # ['/author/Albert-Einstein', '/author/J-K-Rowling']
print(len(soup.select("a.tag")))                                          # 3
```

# Parsers

| Parser | Install | Notes |
| --- | --- | --- |
| `html.parser` | Built in | Good default |
| `lxml` | `pip install lxml` | Fastest |
| `html5lib` | `pip install html5lib` | Most forgiving with broken HTML, slowest |

# Scrape responsibly

> [!TIP] Do
>
> Check the site's terms and `robots.txt`, identify yourself in the User-Agent, pause between requests (`time.sleep(1)`), and prefer an official API when there is one.

> [!DANGER] Avoid
>
> Hammering a site with rapid requests, scraping personal data, or ignoring a site's terms — it can get you blocked or break the law.
