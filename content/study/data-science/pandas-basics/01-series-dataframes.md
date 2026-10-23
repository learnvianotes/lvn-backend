---
id: 4bb5df1a-e094-771f-b8db-ac07d5e57cd6
key: topic:data-science/pandas-basics
subject: data-science
topic: pandas-basics
title: Series & DataFrames
slug: series-dataframes
order: 1
---

Pandas gives Python two labelled data structures — the one-dimensional `Series` and the two-dimensional `DataFrame` — the everyday tools for tabular data.

> [!NOTE] Series
>
> One column: values plus an <strong>index</strong> (labels). Like a NumPy array with names.

> [!NOTE] DataFrame
>
> A table: several Series sharing one index — rows and named columns, like a spreadsheet or SQL table.

# Series

```python filename:Python
import numpy as np
import pandas as pd
s = pd.Series(np.array(["g", "e", "e", "k", "s"]))
print(s.tolist(), s.index.tolist())      # ['g', 'e', 'e', 'k', 's'] [0, 1, 2, 3, 4]
prices = pd.Series([40, 25, 60], index=["tea", "milk", "coffee"])
print(prices["coffee"], prices.max())    # 60 60
print(prices[prices > 30].to_dict())     # {'tea': 40, 'coffee': 60}
```

# Creating DataFrames

```python filename:Python
import pandas as pd
from_rows = pd.DataFrame([["a", 10], ["b", 15], ["c", 14]], columns=["Name", "Age"])
from_dict = pd.DataFrame({"Name": ["Tom", "Jack", "Steve", "Ricky"], "Age": [28, 34, 29, 42]})
print(from_rows.shape, from_dict.shape)          # (3, 2) (4, 2)
print(from_dict)
```

```filename:Output
(3, 2) (4, 2)
    Name  Age
0    Tom   28
1   Jack   34
2  Steve   29
3  Ricky   42
```

> [!WARNING] Pitfall
>
> Building a DataFrame from a NumPy array of mixed values (as the notebook does with `np.array([['a', 10], …])`) turns <strong>every</strong> value into a string — `Age` would be text. Use lists or a dict so each column keeps its own type.

```python filename:Python
import numpy as np
import pandas as pd
bad = pd.DataFrame(np.array([["a", 10], ["b", 15]]), columns=["Name", "Age"])
good = pd.DataFrame([["a", 10], ["b", 15]], columns=["Name", "Age"])
print(bad["Age"].tolist(), good["Age"].tolist())    # ['10', '15'] [10, 15]
```

# Selecting columns and rows

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

print(df.columns.tolist())             # ['species', 'size', 'fragrance', 'height_cm']
print(type(df["species"]).__name__)    # Series
print(df[["species", "fragrance"]].shape)   # (8, 2)
print(df.loc[3, "species"])            # hibiscus      ← by label
print(df.iloc[0]["species"], df.iloc[0]["height_cm"])   # rose 48.55     ← by position
```

| Syntax | Selects |
| --- | --- |
| `df["col"]` | One column → Series |
| `df[["a", "b"]]` | Several columns → DataFrame |
| `df.loc[row_label, col_label]` | By labels (slices include the end) |
| `df.iloc[i, j]` | By integer position (slices exclude the end) |
| `df[df["x"] > 5]` | Rows matching a condition |

# Reading and writing files

```python filename:Python
import pandas as pd
df = pd.DataFrame({"Names": ["Geeks", "For", "Geeks"]}, index=["a", "b", "c"])
df.to_csv("names.csv")                         # writes the index too
back = pd.read_csv("names.csv", index_col=0)   # read it back, using column 0 as the index
print(back.equals(df))                         # True
df.to_csv("names_no_index.csv", index=False)   # usually what you want for exports
```

> [!NOTE] Key point
>
> `read_csv` has many options: `sep`, `header`, `index_col`, `usecols` (pick columns), `nrows` (read only the first n rows), `skiprows`, `parse_dates`. There's also `read_excel`, `read_json`, `read_sql` and `to_…` counterparts.
