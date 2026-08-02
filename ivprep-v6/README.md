# MissionMed IV Prep On-Call V6

This directory contains the isolated local V6 integration candidate for
Y1-Y2-CAM-V6-3401 and its accepted successors.

- `baseline/IV Prep OnCall_V6.html` is the byte-for-byte accepted Fable V6
  source and must remain unchanged.
- `public/index.html` begins as an identical runtime copy and is the only V6
  product surface modified by the local integration.
- `server/`, `providers/`, `config/`, and `test/` are isolated alpha runtime
  code. They do not modify the MissionMed production runtime.

No production route or deployment is authorized by this directory.

## Local launch

Run `npm install && npm start` in this directory, then open
`http://127.0.0.1:8343/`. Port 8343 intentionally avoids the existing donor
proof on port 8320. The server refuses non-loopback hosts.
