---
id: 200ec9eb-8bf9-79ec-a385-5e8edf89a8d7
key: topic:data-science/selenium
subject: data-science
topic: selenium
title: Dynamic Pages with Selenium
slug: dynamic-pages-with-selenium
order: 1
---

Some pages build their content with JavaScript after loading — `requests` only sees the empty shell. Selenium drives a real browser, so you scrape what a user actually sees.

> [!NOTE] requests + BeautifulSoup
>
> Fast and light. Works when the data is in the HTML the server sends.

> [!NOTE] Selenium
>
> Slower, needs a browser. Needed for infinite scroll, clicks, logins and JavaScript-rendered content (YouTube, dashboards).

# Setup (Selenium 4.6+)

```filename:Terminal
pip install selenium beautifulsoup4
```

> [!NOTE] Key point
>
> Selenium 4.6 and later include <strong>Selenium Manager</strong>, which downloads a matching driver automatically. You no longer install `chromedriver` by hand.

> [!WARNING] What went wrong in the notebook
>
> Most of the notebook's Selenium cells failed with <em>“This version of ChromeDriver only supports Chrome version 114 — current browser version is 127”</em>. That's the classic manual-driver problem: the driver and the browser must match. Letting Selenium Manager handle it (just `webdriver.Chrome()`) avoids it.

# Scrolling a dynamic page

```python filename:Python
import time
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument("--headless=new")        # no visible window
driver = webdriver.Chrome(options=options)    # Selenium Manager finds a matching driver
try:
    driver.get("https://quotes.toscrape.com/scroll")
    last = driver.execute_script("return document.body.scrollHeight")
    while True:                               # scroll until the page stops growing
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1.5)
        height = driver.execute_script("return document.body.scrollHeight")
        if height == last:
            break
        last = height
    soup = BeautifulSoup(driver.page_source, "html.parser")
    print(len(soup.find_all("div", class_="quote")))
finally:
    driver.quit()                             # always close the browser
```

# Waiting for elements

```python filename:Python
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Better than time.sleep: wait up to 10 s, continue as soon as the element appears.
first = WebDriverWait(driver, 10).until(
    EC.presence_of_element_located((By.CSS_SELECTOR, "div.quote span.text"))
)
print(first.text)
```

| Selenium | Does |
| --- | --- |
| `driver.get(url)` | Open a page |
| `driver.find_element(By.CSS_SELECTOR, …)` | Find one element (`find_elements` for all) |
| `element.click()` / `.send_keys("text")` | Interact like a user |
| `driver.execute_script(js)` | Run JavaScript (e.g. scroll) |
| `driver.page_source` | The current HTML — hand it to BeautifulSoup |
| `driver.quit()` | Close the browser (use `try/finally`) |

> [!NOTE] Key point
>
> Big sites like YouTube change their HTML often and forbid scraping in their terms; their official APIs (e.g. the YouTube Data API) are the reliable, allowed route.
