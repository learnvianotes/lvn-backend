---
id: 7e2a2a48-76f8-768c-b921-fc1f4a833077
key: topic:data-science/scraping-projects
subject: data-science
topic: scraping-projects
title: Scraping Multiple Pages
slug: scraping-multiple-pages
order: 1
---

Real datasets span many pages. Loop over page URLs, reuse the same extraction code, collect rows, and save them as a table — the notebook's quotes and books scrapers.

# Page URLs

```python filename:Python
urls = [f"https://quotes.toscrape.com/page/{page}/" for page in range(1, 6)]
print(urls[0])       # https://quotes.toscrape.com/page/1/
print(len(urls))     # 5
```

# Extract → rows → DataFrame

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

import pandas as pd
from bs4 import BeautifulSoup

def parse_quotes(html):
    rows = []
    for q in BeautifulSoup(html, "html.parser").find_all("div", class_="quote"):
        rows.append({
            "quote": q.find("span", class_="text").text[1:-1],       # strip the curly quotes
            "author": q.find("small", class_="author").text,
            "details": q.find("a").get("href"),
            "tags": ",".join(t.text for t in q.find_all("a", class_="tag")),
        })
    return rows

pages = [html, html]                        # stand-ins for page 1 and page 2
rows = [row for page in pages for row in parse_quotes(page)]
df = pd.DataFrame(rows)
print(df.shape, df.columns.tolist())        # (4, 4) ['quote', 'author', 'details', 'tags']
print(df.loc[0, "tags"])                    # change,thinking
df.to_csv("quotes.csv", index=False)
```

# The full live scraper

```python filename:Python
import time
import requests
import pandas as pd
from tqdm import tqdm                              # progress bar: pip install tqdm

rows = []
for page in tqdm(range(1, 11)):
    r = requests.get(f"https://quotes.toscrape.com/page/{page}/", timeout=10)
    if r.status_code != 200:
        break                                     # no more pages
    rows += parse_quotes(r.text)
    time.sleep(0.5)                               # be polite
pd.DataFrame(rows).to_csv("quotes.csv", index=False)
```

# Books: fields from attributes

```python filename:Python
from bs4 import BeautifulSoup
html = """
<li class="col-xs-6 col-sm-4 col-md-3 col-lg-3"><article class="product_pod">
  <a href="a-light-in-the-attic_1000/index.html"><img src="../media/cache/2c/da/cover.jpg"></a>
  <p class="star-rating Three"></p>
  <h3><a href="a-light-in-the-attic_1000/index.html" title="A Light in the Attic">A Light in the ...</a></h3>
  <p class="price_color">£51.77</p> <p class="instock availability"> In stock </p>
</article></li>
"""
book = BeautifulSoup(html, "html.parser").find("article", class_="product_pod")
title = book.h3.a["title"]                                   # the full title lives in an attribute
rating = book.find("p", class_="star-rating")["class"][-1]   # the rating is a CSS class
price = float(book.find("p", class_="price_color").text.lstrip("£"))
stock = book.find("p", class_="instock").text.strip()
link = "https://books.toscrape.com/catalogue/" + book.h3.a["href"]
print(title, rating, price, stock)     # A Light in the Attic Three 51.77 In stock
print(link)                            # https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html
```

> [!NOTE] Key point
>
> Visible text is often shortened (“A Light in the ...”); the complete value sits in an attribute (`title`, `alt`, `data-*`). Inspect the page (right-click → <em>Inspect</em>) before writing selectors.

# Joining list pages with detail pages

The notebook scrapes 50 list pages for title/price/link, then visits each book's own page for extra fields (UPC, tax, reviews) and joins the two tables. Join on a shared key, not on row position:

```python filename:Python
import pandas as pd
books = pd.DataFrame({"link": ["b1", "b2"], "title": ["Attic", "Velvet"]})
details = pd.DataFrame({"link": ["b2", "b1"], "upc": ["u-2", "u-1"]})
print(books.merge(details, on="link").to_dict("records"))
# [{'link': 'b1', 'title': 'Attic', 'upc': 'u-1'}, {'link': 'b2', 'title': 'Velvet', 'upc': 'u-2'}]
```

> [!WARNING] Correction
>
> The notebook builds the final table with `df['UPC'] = df_2['UPC']` next to `df_1['Title']` — that only lines up if both lists are in exactly the same order and length. A failed detail page (the notebook's 404) silently shifts every row. Use `merge` on the link.
