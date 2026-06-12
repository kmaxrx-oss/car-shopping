# Tier Logic

## Tier definitions

- Tier A: 2017+ models
- Tier B: 2013+ models
- Tier C: 2005+ models

## Overlap rule

Overlap is allowed across tiers.

If a model family has relevant versions in multiple eras, it can appear in every tier where those versions still fit the search strategy.

## Data shape

The seed data is organized as:

- Tier
  - Make group
    - Model family
      - Tags
      - Optional notes

## Tag meaning

Tags are drivetrain or usefulness categories, not final buying advice.

- `Hybrid/PHEV`
- `Strong 4-cyl`
- `V6/easy-power`
- `Floor`

## Ordering rule inside make groups

Model families within each make group follow this order:

1. Leg room / roominess
2. 4-cylinder preference
3. Clearance / crossover utility
4. Power

This is only an ordering heuristic for the seed list, not a ranking algorithm.
