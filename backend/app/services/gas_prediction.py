from __future__ import annotations

from typing import Sequence


def predict_next_gas_value(history: Sequence[float] | None) -> float | None:
    """Simple trend-based prediction for the next gas value.

    Uses a lightweight weighted moving average with a slope adjustment so the
    existing dashboard endpoint does not fail when the service file is missing.
    """
    if not history:
        return None

    clean = [float(value) for value in history if value is not None]
    if len(clean) < 3:
        return round(clean[-1], 1) if clean else None

    recent = clean[-5:]
    weights = list(range(1, len(recent) + 1))
    weighted_average = sum(v * w for v, w in zip(recent, weights)) / sum(weights)
    slope = recent[-1] - recent[-2]
    prediction = weighted_average + 0.35 * slope
    return round(prediction, 1)
