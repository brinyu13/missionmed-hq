# Deployment Receipt

Production service: Railway RISE service `9bce2090-ce45-4572-8291-e8da5d42acb6`.

- Final deployment: `d0defe18-7de5-4879-9d50-f2cb201e6859` — SUCCESS
- Image: `sha256:96c777addf442b1e1c6f6678ce15dc902896b1953ae690b36965b4f62663d63e`
- Build: `rise_web_900e39cf4108`
- Manifest SHA-256: `51d2d392f5c4c737695a0af2f2d36ff2d17d15296977aae61cf03769db5ec6b8`
- App SHA-256: `53d136a4efdedcf695cd17d66288fe8fc02f3eb636f6f9826d0d7ce9566702b4`
- Server SHA-256: `32186d3b754c1e9e88d02018a2de4c645664a8c60f9be90bd595453a07c6da3b`

An initial attempt `6885a140-3f92-44c8-990e-6f777efc01b5` failed health because provider build pins still referenced the prior manifest; the prior healthy release remained active. Pins were updated to the new exact hashes, an identical-source retry was safely skipped, and the marker-triggered deployment above succeeded.

Provider and normal-origin health both report active production build `rise_web_900e39cf4108`. Research controls remain disabled with the kill switch enabled.

