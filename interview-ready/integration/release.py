"""Local reproducible candidate packaging only. No provider or deployment operations."""
from pathlib import Path
import argparse, gzip, hashlib, importlib.util, io, json, os, subprocess, sys, tarfile, tempfile
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = ROOT.parent


def digest(value): return hashlib.sha256(value).hexdigest()
def encoded(value): return (json.dumps(value, sort_keys=True, indent=2)+'\n').encode()


def safe_file(path):
    path = Path(path)
    if any(part.is_symlink() for part in [path, *path.parents]):
        raise ValueError('Symlink input or output path denied')
    if not path.is_file(): raise ValueError('Missing regular source input')
    return path.read_bytes()


def committed_bytes(ref, name):
    if not ref or ref.startswith('-') or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/._-' for c in ref):
        raise ValueError('Invalid local source reference')
    result = subprocess.run(['git','-C',str(REPOSITORY),'show',ref+':interview-ready/'+name],capture_output=True)
    if result.returncode: raise ValueError('Committed source input unavailable: '+name)
    return result.stdout


def prepare(output, source_ref='HEAD', candidate_working_tree=False):
    output = Path(output).absolute()
    if output.exists() or output.is_symlink(): raise ValueError('Package output collision')
    if any(p.is_symlink() for p in output.parents): raise ValueError('Symlink output path denied')
    if output == REPOSITORY or REPOSITORY in output.parents: raise ValueError('Package output must be outside source repository')
    # Resolve the local ref once. Candidate mode never admits an invalid/missing ref.
    if not source_ref or source_ref.startswith('-') or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/._-' for c in source_ref):
        raise ValueError('Invalid local source reference')
    result = subprocess.run(['git','-C',str(REPOSITORY),'rev-parse','--verify',source_ref+'^{commit}'],capture_output=True)
    if result.returncode: raise ValueError('Local committed source reference unavailable')
    source_commit = result.stdout.decode().strip()
    policy = json.loads(safe_file(ROOT/'production-assets.json'))
    phase = json.loads(safe_file(ROOT/'phase1.json'))
    if phase['releaseState'] == 'production-approved': raise ValueError('This tool prepares candidates only; production decision is external')
    if policy['defaultPolicy'] != 'deny': raise ValueError('Production media allowlist required')
    # Load only the fixed local builder, after its path custody check.
    source = safe_file(ROOT/'build.py')
    builder = type(sys)('ir_release_builder'); builder.__file__ = str(ROOT/'build.py')
    exec(compile(source, builder.__file__, 'exec'), builder.__dict__)
    with tempfile.TemporaryDirectory(prefix='ir-release-build-') as location:
        built = Path(location).resolve()
        manifest = builder.build('production', built)
        if manifest['releaseApproved'] or manifest['assetProfile'] != 'production': raise ValueError('Unapproved candidate profile')
        names = {**manifest['inputs'], **manifest['embeddedAssets'], 'integration/release.py':digest(safe_file(ROOT/'integration/release.py'))}
        # The manifest covers every source and approved media byte used by the builder.
        changed = []
        for name, expected in names.items():
            value = safe_file(ROOT/name)
            if digest(value) != expected: raise ValueError('Build input drift: '+name)
            try: committed = committed_bytes(source_commit,name)
            except ValueError:
                if not candidate_working_tree: raise
                committed = None
            if committed != value: changed.append(name)
        if changed and not candidate_working_tree: raise ValueError('Exact committed inputs required; uncommitted candidate changed: '+', '.join(changed))
        html = safe_file(built/'interview-ready.html')
        if digest(html) != manifest['sha256'] or len(html) != manifest['bytes'] or html.count(b'/* MMED_IR_ACCOUNT_CONTEXT */ null') != 1:
            raise ValueError('Immutable HTML digest or account marker mismatch')
        if b"const store = IRAccount.store;" not in html or b"connect-src 'self'" not in html: raise ValueError('Account/privacy seams missing')
        if b'data:image' not in html: raise ValueError('Bundled approved media missing')
        release = 'wp-content/mu-plugins/missionmed-interview-ready-runtime/releases/'+manifest['sha256']+'/'
        files = {'wp-content/mu-plugins/missionmed-interview-ready.php':safe_file(ROOT/'integration/missionmed-interview-ready.php')}
        for name in ['interview-ready.html','matrix-entry.js','account-gate.html','build-manifest.json']:
            files[release+name] = safe_file(built/name)
        for name, marker in [('matrix-entry.js','MATRIX'),('account-gate.html','GATE')]:
            value = files[release+name]
            prefix = ('<!-- MMED_IR_'+marker+'_SHA256:').encode()
            if html.count(prefix) != 1 or prefix+digest(value).encode()+b' -->' not in html: raise ValueError('Fixed artifact binding mismatch')
            if digest(value) != manifest['fixedArtifacts'][name]['sha256']: raise ValueError('Fixed artifact digest mismatch')
        if b'</script' in files[release+'matrix-entry.js'].lower(): raise ValueError('Unsafe inline addon')
        gate = files[release+'account-gate.html']
        if gate.count(b'{{MMED_IR_ACCOUNT_URL}}') != 1 or gate.count(b'{{MMED_IR_GUIDE_URL}}') != 1 or b'No course enrollment is required' not in gate:
            raise ValueError('Fixed gate markers missing')
        source_state = 'UNCOMMITTED_LOCAL_CANDIDATE_REPACK_FROM_COMMIT_REQUIRED' if changed else 'EXACT_COMMITTED_INPUTS'
        package_manifest = {'schema':'missionmed.interview-ready.local-package.v1','candidate':True,'productionApproved':False,
            'htmlSha256':manifest['sha256'],'sourceRef':source_ref,'sourceCommit':source_commit,'sourceState':source_state,
            'uncommittedInputs':changed,'buildInputs':names,'artifacts':{name:{'sha256':digest(value),'bytes':len(value)} for name,value in sorted(files.items())},
            'sourceMappings':{'gateway':'interview-ready/integration/missionmed-interview-ready.php','html':'build.py + buildInputs; production allowlist only',
                'matrix-entry.js':'interview-ready/integration/matrix-entry.js','account-gate.html':'interview-ready/build.py + approved img/hero-online-photo.webp','build-manifest.json':'interview-ready/build.py'},
            'limitations':['builder candidate only','independent exact-byte/recovery acceptance required','healthy runtime lease and native WP/MySQL/cache/live browser gates outstanding','all 15 shared Matrix bytes and selections must be preserved']}
        plan = {'schema':'missionmed.interview-ready.local-plan.v1','executable':False,'state':'CANDIDATE_HOLD',
            'host':'missionmed-kinsta','webroot':'/www/theresidencyacademy_209/public','releaseDirectory':release.rstrip('/'),
            'currentPointer':'wp-content/mu-plugins/missionmed-interview-ready-runtime/current','pointerStrategy':'qualified atomic current symlink replacement by Foreman only',
            'activation':'independently accept exact committed package and qualified absent/preimage recovery, then acquire narrow healthy runtime lease; Foreman installs dedicated gateway and pointer only',
            'rollback':'restore exact qualified IR gateway and current pointer preimages only; retain _mmed_ir_state_v1, identities, history, enrollment and siblings',
            'matrixScope':'dedicated footer artifact; no shared script selection, cache, lock or renderer changes','productionApproval':False}
        files['release-manifest.json'] = encoded(package_manifest)
        files['release-plan.json'] = encoded(plan)
        # Fixed metadata, order and gzip mtime yield byte-identical archives.
        buffer = io.BytesIO()
        with gzip.GzipFile(fileobj=buffer,mode='wb',filename='',mtime=0) as compressed:
            with tarfile.open(fileobj=compressed,mode='w',format=tarfile.USTAR_FORMAT) as archive:
                for name,value in sorted(files.items()):
                    entry=tarfile.TarInfo(name); entry.size=len(value); entry.mode=0o644; entry.mtime=0; entry.uid=entry.gid=0; entry.uname=entry.gname=''
                    archive.addfile(entry,io.BytesIO(value))
        package = buffer.getvalue()
        output.mkdir(parents=True,exist_ok=False)
        (output/'interview-ready-candidate.tar.gz').write_bytes(package)
        (output/'release-manifest.json').write_bytes(encoded(package_manifest))
        (output/'release-plan.json').write_bytes(encoded(plan))
        receipt={'archiveSha256':digest(package),'archiveBytes':len(package),'htmlSha256':manifest['sha256'],'sourceState':source_state,'productionApproved':False}
        (output/'package-receipt.json').write_bytes(encoded(receipt))
        return receipt


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',type=Path,required=True)
    parser.add_argument('--source-ref',default='HEAD')
    parser.add_argument('--candidate-working-tree',action='store_true',help='Explicit local uncommitted candidate; never eligible for release until repacked from commit')
    args=parser.parse_args()
    try: print(json.dumps(prepare(args.output_dir,args.source_ref,args.candidate_working_tree),indent=2))
    except (ValueError,AssertionError) as error: parser.error(str(error))
