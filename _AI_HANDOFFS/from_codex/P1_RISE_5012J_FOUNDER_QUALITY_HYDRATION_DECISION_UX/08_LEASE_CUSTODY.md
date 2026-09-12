# Lease Custody

All protected mutations used MissionMed Lease V2 scopes with binding SHA-256 `3324c273ae67ff62deee500f9e91596360387ae65f4428535a11b05c534a3ed5`.

Normal releases verified for epochs 2308 through 2316. Epochs 2308-2313 covered code repair, canonical replay, regression tests, build, and commit. Epochs 2314-2315 covered deployment-pin updates. Epoch 2316 covered the successful live deployment.

Two earlier deployment attempts had TTL-boundary anomalies: epoch 2303 expired immediately after the upload crossed the 30-second window, and continuity epoch 2304 later expired. These were not hidden; the final bounded deployment used a heartbeated lease and epoch 2316 released normally after provider success.

The final coordination readback before evidence sealing showed `active_lease_count = 0`.

Evidence-writing epoch 2317 was valid when the handoff files were written but expired before its release call; provider readback recorded `released=false, expired=true`. Checksums and the first custody amendment were written under successor epoch 2318, which likewise expired before its release call. This exact receipt was recorded under successor epoch 2319.
