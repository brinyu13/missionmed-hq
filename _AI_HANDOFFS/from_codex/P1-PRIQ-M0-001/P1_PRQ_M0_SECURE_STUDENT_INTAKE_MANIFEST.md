# Secure student intake manifest

No Ezechiel private packet was found or copied. The API validates manifest metadata only: logical name, class, original filename, MIME type, byte length, SHA-256, subject ID, consent basis, and future retention date. Validation never persists file bytes.

Production intake still requires authenticated signed upload, malware/quarantine processing, encrypted storage outside Git/web root, per-object authorization, deletion/retention jobs, and an approved DB/storage target.
