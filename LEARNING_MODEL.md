# Learning Model

## Philosophy

Keep it simple. No ML. Pure score accumulation with tag-level boosting.
The goal: activities the family has shown interest in appear earlier in the deck next session.

---

## Score rules

| Action | Score delta | Notes |
|--------|-------------|-------|
| Swipe right (♥ Favourite) | +2 | Strong positive signal |
| Swipe up (↑ Basket) | +1 | Moderate positive signal |
| Swipe left (✕ Pass) | −1 | Weak negative signal |

Score floor: **−5** (avoid permanent burial of an activity).
Score ceiling: **none** (much-loved activities accumulate freely).

Stored in `prefs` table as a single integer per `(session_id, activity_id)`.

---

## Deck ordering

On each `/activities` fetch, the backend sorts the returned activities as follows:

```python
# Pseudo-code in activity_service.py
def sort_deck(activities, prefs, date_from, date_to):
    events = [a for a in activities if a.type == 'event']
    evergreen = [a for a in activities if a.type == 'evergreen']

    # Events always come first, sorted by proximity to weekend
    events.sort(key=lambda e: abs((e.date_from - date_from).days))

    # Evergreen sorted by pref score DESC, then by tag_score DESC
    evergreen.sort(key=lambda a: (
        prefs.get(a.id, 0),       # personal score
        tag_score(a.tags, prefs)  # tag affinity score
    ), reverse=True)

    return events + evergreen
```

---

## Tag affinity score

When an activity has no personal score yet (never seen), estimate interest from tags.

```python
def tag_score(tags: list[str], prefs: dict[str, int]) -> float:
    """
    Average pref score of all seen activities sharing these tags.
    Returns 0.0 if no matching history.
    """
    matching_scores = []
    for activity_id, score in prefs.items():
        activity = get_activity(activity_id)
        if activity and set(activity.tags) & set(tags):
            matching_scores.append(score)
    if not matching_scores:
        return 0.0
    return sum(matching_scores) / len(matching_scores)
```

This means: if a family consistently likes "outdoor" + "nature" activities, unseen outdoor/nature activities float up even before the family has explicitly voted on them.

---

## Novelty injection

To prevent the deck from becoming stale (same top 20 forever):

- Every 5th position in the evergreen deck is reserved for a **random unseen activity** (pref_score == 0 and never voted).
- "Unseen" = no row in `prefs` table for this `(session_id, activity_id)`.
- This ensures discovery never fully stops.

```python
def inject_novelty(sorted_deck: list, unseen: list, every_n: int = 5) -> list:
    result = []
    unseen_pool = list(unseen)
    random.shuffle(unseen_pool)
    unseen_iter = iter(unseen_pool)
    for i, item in enumerate(sorted_deck):
        if i > 0 and i % every_n == 0 and unseen_pool:
            try:
                result.append(next(unseen_iter))
            except StopIteration:
                pass
    return result
```

---

## Favourite persistence

Activities voted 'yes' (♥) are considered **family favourites** regardless of session.
They are surfaced in the Favourites tab and can be re-added to any future basket.
Their score is also treated as a floor: a favourite cannot drop below score=2 even if later passed.

```python
def apply_vote(session_id, activity_id, direction):
    pref = get_or_create_pref(session_id, activity_id)
    delta = {'yes': 2, 'up': 1, 'no': -1}[direction]
    new_score = max(-5, pref.score + delta)
    # Favourites floor
    if pref.score >= 2 and direction == 'no':
        new_score = max(2, new_score)
    pref.score = new_score
    save(pref)
```

---

## What is NOT implemented (keep out of v1)

- Collaborative filtering across sessions (requires user base)
- Time-of-year seasonality (winter vs summer preferences)
- Weather-based filtering (would require weather API)
- Age-based filtering (removed per product decision — no family member profiles)
- Any ML model — simple arithmetic is enough for this scale
