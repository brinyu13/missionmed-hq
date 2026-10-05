import hashlib,json,os,shutil
expected='/usr/local/bin/wp'
resolved=shutil.which('wp')
php=shutil.which('php')
matched=resolved is not None and os.path.realpath(resolved)==os.path.realpath(expected)
expected_hash='ce34ddd838f7351d6759068d09793f26755463b4a4610a5a5c0a97b68220d85c'
def pinned():
 try:
  with open(expected,'rb') as f: value=hashlib.sha256(f.read(8000000)).hexdigest()
  return value==expected_hash
 except Exception:return False
print(json.dumps({'schema':'ir.cli.command_resolution.v1','wpFound':resolved is not None,'qualifiedWpResolved':matched,'qualifiedWpHashMatches':pinned(),'phpFound':php is not None,'effectiveUidZero':os.geteuid()==0,'stdinPathExists':os.path.exists('/dev/stdin')},sort_keys=True,separators=(',',':')))
