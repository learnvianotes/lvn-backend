---
id: 63c28a5f-a667-7d44-8097-5cca645124ff
key: topic:data-science/pandas-analysis
subject: data-science
topic: pandas-analysis
title: Exploring a Dataset
slug: exploring-a-dataset
order: 1
---

A first pass over any new dataset: look at it, check types and missing values, summarise, filter, group. Here with a small version of the notebook's flower dataset.

# First look

```python filename:Python
import pandas as pd
from io import StringIO

csv = """species,size,fragrance,height_cm
rose,medium,mild,48.55
shoeblack plant,medium,mild,147.07
shoeblack plant,medium,none,102.93
hibiscus,large,none,184.00
shoeblack plant,large,mild,83.07
rose,small,strong,35.20
hibiscus,large,,126.69
rose,medium,mild,88.11
"""
df = pd.read_csv(StringIO(csv))       # same call you'd use with a file path

print(df.shape)                                  # (8, 4)
print(df.head(2).to_dict("records"))             # [{'species': 'rose', 'size': 'medium', 'fragrance': 'mild', 'height_cm': 48.55}, {'species': 'shoeblack plant', 'size': 'medium', 'fragrance': 'mild', 'height_cm': 147.07}]
print(df.dtypes.astype(str).to_dict())           # {'species': 'str', 'size': 'str', 'fragrance': 'str', 'height_cm': 'float64'}
```

| Method | Tells you |
| --- | --- |
| `df.head(n)` / `df.tail(n)` | First / last rows |
| `df.shape` | (rows, columns) |
| `df.info()` | Column types and non-null counts |
| `df.describe()` | Count, mean, std, min, quartiles, max of numeric columns |
| `df["col"].value_counts()` | How often each value appears |
| `df.isna().sum()` | Missing values per column |

# Missing values

```python filename:Python
import pandas as pd
from io import StringIO

csv = """species,size,fragrance,height_cm
rose,medium,mild,48.55
shoeblack plant,medium,mild,147.07
shoeblack plant,medium,none,102.93
hibiscus,large,none,184.00
shoeblack plant,large,mild,83.07
rose,small,strong,35.20
hibiscus,large,,126.69
rose,medium,mild,88.11
"""
df = pd.read_csv(StringIO(csv))       # same call you'd use with a file path

print(df.isna().sum().to_dict())                 # {'species': 0, 'size': 0, 'fragrance': 1, 'height_cm': 0}
filled = df.fillna({"fragrance": "unknown"})
print(filled.loc[6, "fragrance"])                # unknown
print(len(df.dropna()))                          # 7
```

> [!NOTE] Key point
>
> Decide per column: <strong>drop</strong> rows (`dropna`), <strong>fill</strong> with a value or the mean/median (`fillna`), or keep and flag. Never silently ignore them.

# Summaries

```python filename:Python
import pandas as pd
from io import StringIO

csv = """species,size,fragrance,height_cm
rose,medium,mild,48.55
shoeblack plant,medium,mild,147.07
shoeblack plant,medium,none,102.93
hibiscus,large,none,184.00
shoeblack plant,large,mild,83.07
rose,small,strong,35.20
hibiscus,large,,126.69
rose,medium,mild,88.11
"""
df = pd.read_csv(StringIO(csv))       # same call you'd use with a file path

print(df["species"].value_counts().to_dict())     # {'rose': 3, 'shoeblack plant': 3, 'hibiscus': 2}
print(round(df["height_cm"].mean(), 2))           # 101.95
print(df["height_cm"].describe()[["min", "max"]].tolist())   # [35.2, 184.0]
```

# Filtering, sorting and grouping

```python filename:Python
import pandas as pd
from io import StringIO

csv = """species,size,fragrance,height_cm
rose,medium,mild,48.55
shoeblack plant,medium,mild,147.07
shoeblack plant,medium,none,102.93
hibiscus,large,none,184.00
shoeblack plant,large,mild,83.07
rose,small,strong,35.20
hibiscus,large,,126.69
rose,medium,mild,88.11
"""
df = pd.read_csv(StringIO(csv))       # same call you'd use with a file path

tall = df[df["height_cm"] > 100]
print(tall["species"].tolist())                                   # ['shoeblack plant', 'shoeblack plant', 'hibiscus', 'hibiscus']
print(df[(df["size"] == "medium") & (df["fragrance"] == "mild")].shape[0])   # 3
print(df.sort_values("height_cm", ascending=False).iloc[0]["species"])       # hibiscus
print(df.groupby("species")["height_cm"].mean().round(1).to_dict())
# {'hibiscus': 155.3, 'rose': 57.3, 'shoeblack plant': 111.0}
```

> [!WARNING] Watch out
>
> Combine conditions with `&` (and), `|` (or), `~` (not) — <strong>not</strong> `and`/`or` — and wrap each condition in parentheses.

# New columns

```python filename:Python
import pandas as pd
from io import StringIO

csv = """species,size,fragrance,height_cm
rose,medium,mild,48.55
shoeblack plant,medium,mild,147.07
shoeblack plant,medium,none,102.93
hibiscus,large,none,184.00
shoeblack plant,large,mild,83.07
rose,small,strong,35.20
hibiscus,large,,126.69
rose,medium,mild,88.11
"""
df = pd.read_csv(StringIO(csv))       # same call you'd use with a file path

df["height_m"] = (df["height_cm"] / 100).round(2)
df["is_tall"] = df["height_cm"] > 100
print(df.loc[1, "height_m"], df.loc[1, "is_tall"])   # 1.47 True
```
