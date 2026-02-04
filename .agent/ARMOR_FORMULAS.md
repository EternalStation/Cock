# Player Armor & Damage Reduction Formulas (Updated)

## Core Formula

The game uses a power-logarithmic formula for damage reduction from armor, capped at **95%**. This formula ensures a smoother progression across early, mid, and late game.

$$ \text{Reduction} = \min(0.95, 0.165 \times (\log_{10}(\text{Armor} + 1))^{1.1}) $$

## Target Reduction Table

The current tuning targets the following armor points for major reduction milestones:

| Target Reduction | Damage Taken | Armor Required | Progression Stage |
| :--- | :--- | :--- | :--- |
| **0%** | 100% | 0 | Base |
| **25%** | 75% | ~61 | Early Game |
| **50%** | 50% | ~500 | Mid Game |
| **75%** | 25% | ~8,000 | Late Game |
| **95%** | 5% | ~100,000 | **Hard Cap Limit** |

## Implementation Note

The formula is centralized in `MathUtils.ts` via the `getDefenseReduction(armor)` function. It uses a base-10 logarithm with a slightly-more-than-linear power ($1.1$) to hit the desired milestones precisely.

*   **25% Reduction**: Achieved at 61 Armor ($0.165 \times \log10(62)^{1.1} \approx 0.25$)
*   **50% Reduction**: Achieved at 500 Armor ($0.165 \times \log10(501)^{1.1} \approx 0.50$)
*   **75% Reduction**: Achieved at 8,000 Armor ($0.165 \times \log10(8001)^{1.1} \approx 0.74$)
*   **95% Reduction**: Achieved at 100,000 Armor ($0.165 \times \log10(100001)^{1.1} \approx 0.97 \rightarrow \text{capped at } 0.95$)
