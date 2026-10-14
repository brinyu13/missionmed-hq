const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const guard=path.resolve(__dirname,'../../../../..','_SYSTEM/scripts/mm-preflight.sh');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mmed-preflight-'));
const run=(cmd,args=[])=>cp.spawnSync(cmd,args,{cwd:dir,encoding:'utf8'});
try {
  assert.equal(run('git',['init','-b','test']).status,0);
  fs.writeFileSync(path.join(dir,'tracked.txt'),'baseline');
  fs.mkdirSync(path.join(dir,'wp-content/mu-plugins'),{recursive:true});
  fs.writeFileSync(path.join(dir,'wp-content/mu-plugins/baseline.php'),'baseline');
  run('git',['add','.']);assert.equal(run('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture']).status,0);
  for(const bash of ['/bin/bash','/opt/homebrew/bin/bash']) {
    let check=scope=>run(bash,[guard,...(scope?['--edit-scope',scope]:[])]);
    assert.equal(check().status,0);assert.equal(check('other.txt').status,0);
    fs.appendFileSync(path.join(dir,'tracked.txt'),'dirty');assert.equal(check('other.txt').status,0);
    assert.match(check('tracked.txt').stdout,/Dirty overlap detected/);
    fs.writeFileSync(path.join(dir,'untracked.txt'),'new');assert.equal(check('other.txt').status,0);
    fs.mkdirSync(path.join(dir,'wp-content/mu-plugins'),{recursive:true});fs.writeFileSync(path.join(dir,'wp-content/mu-plugins/risk.php'),'fixture');
    assert.equal(check('wp-content/mu-plugins').status,1);
    assert.match(check('wp-content/mu-plugins/risk.php').stdout,/Sensitive dirty overlap/);
    fs.unlinkSync(path.join(dir,'wp-content/mu-plugins/risk.php'));fs.unlinkSync(path.join(dir,'untracked.txt'));fs.writeFileSync(path.join(dir,'tracked.txt'),'baseline');
  }
  console.log('PASS: Bash3/Bash5 clean, empty scope, tracked-only, mixed, ordinary and sensitive overlap guards');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
