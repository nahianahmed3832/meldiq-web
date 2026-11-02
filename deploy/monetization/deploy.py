#!/usr/bin/env python3
"""Publish reviewed artifacts under the shared lease; preserve configuration and retain a schema-10 fallback before new paid terms are published."""
import datetime, fcntl, hashlib, json, os, shutil, subprocess, tarfile, time, urllib.request
from pathlib import Path
import yaml
os.umask(0o077)
run=Path('/opt/griip-internal-messaging/releases/plus-release-20261102-final')
base=Path('/opt/griip-internal-messaging');api='griip-internal-messaging-api-1'
manifest=json.loads((run/'RELEASE.json').read_text())
lease=json.loads((run/'release-lock-held.json').read_text())
def guard():
    assert lease['owner']=='plus-release-20261102'
    os.kill(lease['pid'],0);assert not (run/'release-lock.done').exists()
    with open('/run/lock/meldiq-production-release.lock','a+') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_SH|fcntl.LOCK_NB)
        except BlockingIOError:pass
        else:raise RuntimeError('Exclusive production lease missing')
def command(args,log=None,stdin=None):
    result=subprocess.run(args,input=stdin,capture_output=True,check=False,cwd=base)
    if log:
        (run/log).write_bytes(result.stdout)
        (run/(log+'.stderr')).write_bytes(result.stderr)
    if result.returncode:raise RuntimeError('Release command failed; inspect private '+str(log))
    return result.stdout
def inspection():return json.loads(command(['docker','inspect',api]))[0]
def response(path):
    with urllib.request.urlopen('http://127.0.0.1:18080'+path,timeout=10) as r:return json.load(r)
def health(version):
    h=response('/healthz');assert h.get('ok') and h.get('redis') and h.get('version')==version
    return h
def wait_healthy(version):
    deadline=time.monotonic()+180
    while time.monotonic()<deadline:
        guard()
        try:
            if inspection()['State'].get('Health',{}).get('Status')=='healthy':return health(version)
        except Exception:pass
        time.sleep(2)
    raise RuntimeError('Candidate health deadline exceeded')
def maintenance(action):
    return command(['python3',str(run/'maintenance-proxy.py'),action,'--run-directory',str(run)],'maintenance-'+action+'.json')
def switch(link,target):
    temporary=link.with_name('plus-next-20261102');assert not temporary.exists() and not temporary.is_symlink()
    temporary.symlink_to(target);os.replace(temporary,link)
def compose_image(image):
    before=yaml.safe_load((run/'compose.before.yaml').read_text());before['services']['api']['image']=image
    original=(run/'compose.before.yaml').read_text();old=yaml.safe_load(original)['services']['api']['image']
    assert original.count(old)==1
    text=original.replace(old,image);assert yaml.safe_load(text)==before
    temp=base/'compose.plus.tmp';temp.write_text(text);os.chmod(temp,(base/'compose.yaml').stat().st_mode);os.replace(temp,base/'compose.yaml')
    command(['docker','compose','-p','griip-internal-messaging','-f','compose.yaml','config','-q'],'compose-validate.log')
def recreate(log):command(['docker','compose','-p','griip-internal-messaging','-f','compose.yaml','up','-d','--no-deps','--no-build','--pull','never','api'],log)
def snapshot(name):
    data=command(['docker','exec','-i',api,'node','--input-type=module'],name,stdin=(run/'accounts-check.mjs').read_bytes())
    return json.loads(data)
def financial_snapshot(name):
    data=command(['docker','exec','-i',api,'node','--input-type=module'],name,stdin=(run/'financial-check.mjs').read_bytes())
    return json.loads(data)
def wait_runtime_permissions():
    (run/'schema-ready-for-permission-restoration.json').write_text(json.dumps({'schema':10,'runtimeHealthy':True,'readyToRestoreReadWrite':True})+'\n')
    print(json.dumps({'schemaPrepared':True,'awaitingOriginalRuntimePermissions':True}),flush=True)
    script=b"import {MongoClient} from 'mongodb';const c=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:1,serverSelectionTimeoutMS:10000});try{await c.connect();const r=await c.db('admin').command({connectionStatus:1,showPrivileges:true});const a=new Set((r.authInfo.authenticatedUserPrivileges??[]).flatMap(p=>p.actions));const roles=(r.authInfo.authenticatedUserRoles??[]).map(p=>p.role+'@'+p.db).sort();console.log(JSON.stringify({canCollMod:a.has('collMod'),rolesRestored:JSON.stringify(roles)===JSON.stringify(['readWrite@meldiq']),freshConnection:true}));}finally{await c.close();}"
    deadline=time.monotonic()+900
    while time.monotonic()<deadline:
        guard()
        status=json.loads(command(['docker','exec','-i',api,'node','--input-type=module'],stdin=script))
        if not status['canCollMod'] and status['rolesRestored']:
            (run/'permissions-restored.json').write_text(json.dumps(status)+'\n')
            return
        time.sleep(5)
    raise RuntimeError('Original runtime permissions were not restored before reopening traffic')
def probe(name):
    data=command(['docker','exec','-i',api,'node','--input-type=module'],name,stdin=(run/'probe-migration.mjs').read_bytes())
    assert json.loads(data)['ok']
def nginx_snapshot(name):return command(['nginx','-T'],name)
def served(host,relative,expected):
    data=command(['curl','--connect-timeout','5','--max-time','20','-fsS','--resolve',host+':443:127.0.0.1','https://'+host+'/'+relative])
    assert hashlib.sha256(data).digest()==hashlib.sha256(expected.read_bytes()).digest(),'Served asset mismatch'
def preserve(before,after):
    assert sorted(before['Config']['Env'])==sorted(after['Config']['Env']),'Environment changed'
    for key in ['PortBindings','Memory','MemorySwap','NanoCpus','CpuQuota','CpuPeriod','ReadonlyRootfs']:
        assert before['HostConfig'][key]==after['HostConfig'][key],key+' changed'
    assert sorted(before['Mounts'],key=lambda m:m['Destination'])==sorted(after['Mounts'],key=lambda m:m['Destination']),'Mounts changed'
def prepare_archive(name,target,subdir=None):
    destination=target/subdir if subdir else target
    if target.exists():
        # A retry may reuse only our byte-identical, unpublished staged artifacts.
        assert target.is_dir() and not target.is_symlink()
        with tarfile.open(run/name) as archive:
            for member in archive.getmembers():
                assert member.isfile() and not Path(member.name).is_absolute() and '..' not in Path(member.name).parts
                existing=destination/member.name
                assert existing.is_file() and not existing.is_symlink()
                assert hashlib.sha256(existing.read_bytes()).digest()==hashlib.sha256(archive.extractfile(member).read()).digest()
    else:
        destination.mkdir(parents=True)
        with tarfile.open(run/name) as archive:archive.extractall(destination,filter='data')
def retain_assets(old,new,folder):
    for p in (old/folder).rglob('*'):
        if p.is_file():
            q=new/p.relative_to(old)
            if not q.exists():q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)

guard()
assert manifest['validation']['allRequiredChecksPassed'] is True
assert json.loads((run/'rehearsal.json').read_text())['candidateAndRollbackVerified'] is True
assert json.loads((run/'backup-preflight.json').read_text())['verified'] is True
assert manifest['newPaidTermsPublished'] is False
assert manifest['campaignsEnabled'] is False
for name,digest in manifest['archives'].items():assert hashlib.sha256((run/name).read_bytes()).hexdigest()==digest
web_lock=open('/opt/meldiq-web/.deploy.lock','a+')
fcntl.flock(web_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
before=inspection();assert before['Image']==manifest['expectedApiImageId']
assert before['State']['Health']['Status']=='healthy'
assert before['HostConfig']['Memory']==805306368
oldadmin=Path(manifest['expectedAdminRelease']);oldweb=Path(manifest['expectedWebRelease'])
assert Path('/opt/meldiq-admin/current').resolve()==oldadmin
assert Path('/opt/meldiq-web/current').resolve()==oldweb
assert int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))>1048576
health('0.76.1')
providers=response('/v2/auth/social/config')['providers']
old_catalog=response('/v2/mojo/catalog')
shutil.copy2(base/'compose.yaml',run/'compose.before.yaml')
environment_hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [base/'.env',base/'database-migration/.env.redis']}
(run/'environment-hashes.json').write_text(json.dumps(environment_hashes))
(run/'container.before.json').write_text(json.dumps(before))
nginx_before=nginx_snapshot('nginx.before.txt')
newadmin=Path(manifest['adminRelease']);newweb=Path(manifest['webRelease'])
prepare_archive('admin.tar.gz',newadmin,'dist')
prepare_archive('web.tar.gz',newweb)
retain_assets(oldadmin/'dist',newadmin/'dist','assets')
retain_assets(oldweb,newweb,'_next/static')
shutil.copy2(oldweb/'config.json',newweb/'config.json')
assert (oldweb/'config.json').read_bytes()==(newweb/'config.json').read_bytes()
for directory in [newadmin,newweb]:command(['chmod','-R','a+rX',str(directory)])
activated=False;gated=False;opened_public=False
started=datetime.datetime.now(datetime.UTC)
try:
    maintenance('enable');gated=True
    accounts_before=snapshot('accounts.before.json')
    finance_before=financial_snapshot('financial.before.json')
    compose_image(manifest['apiImage']);activated=True
    recreate('recreate.log');wait_healthy('0.76.1')
    after=inspection();preserve(before,after)
    (run/'container.after.json').write_text(json.dumps(after))
    accounts_after=snapshot('accounts.after.json')
    assert all(accounts_after['accounts'].get(k)==v for k,v in accounts_before['accounts'].items()),'Existing account changed'
    assert accounts_after['schema']==10 and accounts_after['databaseMode']=='atlas' and len(accounts_after['domains'].split(','))==16
    probe('production-schema.json')
    finance_after=financial_snapshot('financial.after.json')
    for table, rows in finance_before.items():
        assert all(finance_after.get(table,{}).get(k)==v for k,v in rows.items()),'Existing billing record changed: '+table
    info=response('/v1/server-info')
    assert 'platform-operations' in info['features']
    catalog=response('/v2/mojo/catalog')
    assert catalog['onSale']['plus'] is None and all(not t['available'] for t in catalog['plusTerms']), 'New paid Plus terms must remain unpublished'
    for product in ['spark','botsPlus']:
        assert catalog['onSale'].get(product)==old_catalog['onSale'].get(product), 'Unrelated product changed: '+product
    assert info['fileMaxBytes']==1000000000
    assert response('/v2/auth/social/config')['providers']==providers
    assert 'https://web.meldiq.app' in info['passkeys']['webOrigins']
    for endpoint in ['/admin/v1/operations/notices','/admin/v1/operations/appeals','/admin/v1/operations/orders','/admin/v1/operations/policy','/v2/platform/notices','/v2/collectible-purchases']:
        headers=['-H','Host: admin.meldiq.app','-H','X-Meldiq-Admin: 1'] if endpoint.startswith('/admin/') else []
        status=command(['curl','-sS','-o','/dev/null','-w','%{http_code}',*headers,'http://127.0.0.1:18080'+endpoint]).decode()
        assert status in ['401','403'],'Unauthenticated operations route did not fail closed: '+endpoint
    switch(Path('/opt/meldiq-admin/current'),newadmin)
    switch(Path('/opt/meldiq-web/current'),newweb)
    served('admin.meldiq.app','',newadmin/'dist/index.html')
    for asset in ['index.html','sw.js','social-auth-callback.js','auth-provider-icons/google.svg','auth-provider-icons/discord.svg']:
        served('web.meldiq.app',asset,newweb/asset)
    for name,digest in environment_hashes.items():assert hashlib.sha256(Path(name).read_bytes()).hexdigest()==digest
    wait_runtime_permissions()
    maintenance('disable');gated=False;opened_public=True
    assert nginx_snapshot('nginx.after.txt')==nginx_before,'Ingress config changed'
    health('0.76.1');probe('production-schema-final.json')
    elapsed=(datetime.datetime.now(datetime.UTC)-started).total_seconds()
    receipt={'status':'deployed-and-verified','deployedAt':datetime.datetime.now(datetime.UTC).isoformat(),'apiVersion':'0.76.1','adminVersion':'1.7.0','apiImage':manifest['apiImage'],'apiImageId':after['Image'],'webRelease':str(newweb),'adminRelease':str(newadmin),'schemaVersion':10,'atlasDomains':16,'redisHealthy':True,'accountCountBefore':accounts_before['count'],'accountCountAfter':accounts_after['count'],'existingAccountsPreserved':True,'environmentPortsMountsResourcesPreserved':True,'nginxConfigurationPreserved':True,'retainedPriorAssets':True,'rollbackImage':manifest['rollbackImage'],'cutoverAndVerificationSeconds':elapsed,'webSource':manifest['webSource'],'apiSource':manifest['apiSource'],'adminSource':manifest['adminSource'],'newPaidTermsPublished':False,'campaignsEnabled':False,'existingFinancialRecordsPreserved':True,'runtimePermissionsRestored':True}
    (run/'production-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt),flush=True)
except BaseException:
    # Retain schema 10. The fallback is valid while the new paid terms remain unpublished.
    if activated:
        if not gated:maintenance('enable');gated=True
        compose_image(manifest['rollbackImage']);recreate('rollback.log');wait_healthy('0.76.1');probe('rollback-schema.json')
    switch(Path('/opt/meldiq-admin/current'),oldadmin);switch(Path('/opt/meldiq-web/current'),oldweb)
    if gated and not opened_public:maintenance('disable')
    (run/'rollback-receipt.json').write_text(json.dumps({'restoredCompatibleCode':activated,'schemaDowngraded':False,'customerDataRestored':False,'previousSitesRestored':True,'maintenanceRetainedAfterPublicOpening':opened_public})+'\n')
    raise
