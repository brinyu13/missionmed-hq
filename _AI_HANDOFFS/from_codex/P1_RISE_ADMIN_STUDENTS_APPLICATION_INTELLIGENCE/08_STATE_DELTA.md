# State Delta

| Surface | Before | After |
|---|---|---|
| Admin student visibility | No coherent Students workspace | Read-only searchable student index and detail |
| Student program truth | Canonical saved/application rows | Same rows; no duplicate store |
| Highest interest | No canonical gold field | Shared `gold_starred` field visible to student and admin |
| Admin mutation | None | None |
| Student privacy | Subject-isolated | Preserved; notes omitted from admin responses |
| Authorization | Existing operator capability | Reused and server-enforced |
| Program context | Separate Program File | Joined summary plus canonical Program File navigation |
| Registry | 6,139 / 31 | 6,139 / 31 |
| Fable UI | Protected | Preserved |
| Paid research | $0 | $0 |

Final source head before evidence custody: `6e80abb20861276d1e94ece84e889f1d5c54a411`.

Production status: LIVE. The deployed runtime is functionally complete at `e332f06`; the one later commit is test-adapter/test coverage only and does not alter live Postgres behavior.
