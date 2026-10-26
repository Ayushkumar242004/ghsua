from __future__ import annotations

from statistics import mean
from math import sqrt
from typing import Iterable


def calculate_error(forecast: float, actual: float) -> float:
    return forecast - actual


def calculate_absolute_error(forecast: float, actual: float) -> float:
    return abs(calculate_error(forecast, actual))


def calculate_mae(errors: Iterable[float]) -> float:
    values = list(errors)
    return mean(abs(value) for value in values) if values else 0.0


def calculate_rmse(errors: Iterable[float]) -> float:
    values = list(errors)
    return sqrt(mean(value * value for value in values)) if values else 0.0


def calculate_bias(errors: Iterable[float]) -> float:
    values = list(errors)
    return mean(values) if values else 0.0


def calculate_mape(forecasts: Iterable[float], actuals: Iterable[float], threshold: float = 1.0) -> float:
    pairs = [(forecast, actual) for forecast, actual in zip(forecasts, actuals) if abs(actual) >= threshold]
    return mean(abs((forecast - actual) / actual) for forecast, actual in pairs) * 100 if pairs else 0.0


def percentile(values: Iterable[float], quantile: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = (len(ordered) - 1) * quantile
    lower, upper = int(index), min(int(index) + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def calculate_horizon(delivery_time, publish_time):
    return (delivery_time - publish_time).total_seconds() / 3600


def select_latest_eligible_forecast(records, cutoff):
    eligible = [record for record in records if record.publish_time <= cutoff]
    return max(eligible, key=lambda record: record.publish_time, default=None)
