---
id: 226f570e-79eb-768a-be01-14d2d7184ab8
key: topic:ml-ai/time-series
subject: ml-ai
topic: time-series
title: Time-Series Basics
slug: time-series-basics
order: 1
---

A time series is a sequence of observations in time order — sales per day, CPU load per minute. Order matters: neighbouring values are correlated, the future must never leak into the past, and a simple “same as last week” baseline is surprisingly hard to beat.

| Component | Meaning | Example |
| --- | --- | --- |
| Trend | Long-term increase or decrease | Growing user base |
| Seasonality | Repeating pattern with a fixed period | Weekly shopping cycle, yearly peaks |
| Cycles | Rises and falls without a fixed period | Business cycles |
| Noise | Irregular variation | Random day-to-day fluctuation |

> [!INFO]
>
> <strong>Stationarity</strong> — a series whose statistical properties (mean, variance, autocorrelation) don't change over time. Classical models like ARIMA assume it; trends and seasonality are removed first, e.g. by <strong>differencing</strong> (`y_t − y_{t−1}`, or `y_t − y_{t−7}` for weekly seasonality).

# A forecasting example

Daily demand with a trend, a weekly pattern and noise. Forecast the last 28 days using only information available the day before:

```python filename:Python
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error

rng = np.random.default_rng(0)
days = pd.date_range("2024-01-01", periods=364, freq="D")
t = np.arange(364)
weekly = np.array([0, 2, 3, 3, 5, 12, 9])[days.dayofweek]          # busier on weekends
y = pd.Series(50 + 0.05 * t + weekly + rng.normal(0, 2, 364), index=days)

print(round(y.autocorr(lag=1), 2), round(y.autocorr(lag=7), 2))     # 0.68 0.91 ← strong weekly autocorrelation

df = pd.DataFrame({"y": y})
df["lag_1"] = y.shift(1)                                  # yesterday
df["lag_7"] = y.shift(7)                                  # same weekday last week
df["roll_7"] = y.shift(1).rolling(7).mean()               # past week's mean — shift FIRST, then roll
df["dow"] = df.index.dayofweek
df = pd.get_dummies(df, columns=["dow"], dtype=float).dropna()

train, test = df.iloc[:-28], df.iloc[-28:]                 # split by time, never shuffle
X_cols = [c for c in df.columns if c != "y"]
model = Ridge(alpha=1.0).fit(train[X_cols], train["y"])

print(round(mean_absolute_error(test["y"], test["lag_1"]), 2))                 # 5.18 ← naive: tomorrow = today
print(round(mean_absolute_error(test["y"], test["lag_7"]), 2))                 # 2.51 ← seasonal naive: = last week
print(round(mean_absolute_error(test["y"], model.predict(test[X_cols])), 2))   # 1.99 ← model with lag + calendar features
```

> [!WARNING] Watch out
>
> `y.rolling(7).mean()` without the `shift(1)` includes today's value — the very thing you are predicting. Build every lag/rolling/aggregate feature from data strictly before the prediction time, and validate with `TimeSeriesSplit` or a hold-out of the latest period.

# Approaches

| Family | Examples | Good for |
| --- | --- | --- |
| Baselines | Naive, seasonal naive, moving average | Always — the bar to beat |
| Classical statistical | Exponential smoothing (ETS, Holt-Winters), ARIMA/SARIMA (`statsmodels`) | Single series, clear trend/seasonality, small data, prediction intervals |
| ML on engineered features | Lags, rolling stats, calendar and holiday features + gradient boosting / linear models | Many related series, external drivers (price, promotions, weather) |
| Deep learning | RNN/LSTM, temporal CNNs, transformers (see <strong>Deep Learning</strong>) | Very many long series, complex patterns |

# Practical points

- <strong>Multi-step horizons</strong>: recursive (feed predictions back as lags) accumulates errors; direct (one model per horizon) avoids that at more cost.
- <strong>Metrics</strong>: MAE/RMSE per horizon; MASE = MAE ÷ MAE of the seasonal-naive forecast (below 1 beats the baseline); avoid MAPE with values near 0.
- <strong>Validation</strong>: rolling-origin (expanding window) evaluation mirrors how forecasts are produced in production.
- <strong>Label availability</strong>: if yesterday's sales are only final two days later, `lag_1` isn't available at prediction time — use a gap.
- Report <strong>prediction intervals</strong>, not only point forecasts — inventory and staffing decisions depend on the uncertainty.

```question
How is validating a time-series model different?

---

The split must respect time: train on the past, validate on the following period (walk-forward / `TimeSeriesSplit`), never shuffle, and make sure every feature uses only information available at the forecast origin. Random K-fold leaks the future and gives optimistic errors.
```

```question
What is stationarity and why does it matter?

---

Constant mean, variance and autocorrelation over time. ARIMA-type models assume it, and non-stationary series produce spurious correlations. Detrend or difference the series (and test with ADF/KPSS) before fitting such models; tree models on lag features are more forgiving but still can't extrapolate a trend.
```

```question
What baseline would you use for a forecasting problem?

---

The naive forecast (last value) and the seasonal naive forecast (value one season ago, e.g. same weekday last week). Many sophisticated models fail to beat them; MASE expresses error relative to that baseline.
```
