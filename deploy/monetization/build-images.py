from pathlib import Path
import subprocess,json,hashlib,os,tarfile
r=Path('/opt/griip-internal-messaging/releases/plus-release-20261102-final')
l=json.loads((r/'release-lock-held.json').read_text());assert l['owner']=='plus-release-20261102';os.kill(l['pid'],0);assert not (r/'release-lock.done').exists()
before=json.loads(subprocess.check_output(['docker','inspect','griip-internal-messaging-api-1']))[0]
assert before['Image']=='sha256:eab54f29aa5e23bac5ce3fadc0a179f797b43b479f935e7c449cfdf804c5a3f1'
assert before['State']['Health']['Status']=='healthy'
assert int(next(s.split()[1] for s in Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))>2621440
archive=r/'api-compiled.tar.gz';assert hashlib.sha256(archive.read_bytes()).hexdigest()=='756169c2e72607e2e51c7319f36460d26759f59f7f57ee3f56c8642343f48820'
target=r/'compiled';target.mkdir(exist_ok=True)
with tarfile.open(archive) as t:t.extractall(target,filter='data')
candidate='griip-internal-messaging-api:0.76.1-plus-708353fe'
fallback='griip-internal-messaging-api:0.76.1-plus-floor10-708353fe'
def build(folder,tag,log):
 with (r/log).open('wb') as out:
  subprocess.run(['docker','build','--pull=false','--memory=256m','--memory-swap=256m','--cpu-quota=50000','--cpu-period=100000','-t',tag,str(folder)],stdout=out,stderr=subprocess.STDOUT,env={**os.environ,'DOCKER_BUILDKIT':'0'},check=True)
build(target,candidate,'image-build.log')
floor=r/'fallback';floor.mkdir(exist_ok=True)
s='FROM griip-internal-messaging-api:0.76.1-read-receipts-0f77a9d8\n'
for name in ['dist/infrastructure/database/schema.generated.js','dist/infrastructure/database/mongo/client.js','dist/infrastructure/database/mongo/catalog.js']:
 s+=f'COPY --from={candidate} /app/{name} /app/{name}\n'
s+=f'COPY --from={candidate} /app/migrations/ /app/migrations/\nLABEL app.meldiq.rollback="schema10-before-new-paid-terms"\n'
(floor/'Dockerfile').write_text(s);build(floor,fallback,'fallback-build.log')
script=b"import assert from 'node:assert/strict';import {openDatabase} from './dist/infrastructure/database/db.js';import {MONGO_SCHEMA_VERSION} from './dist/infrastructure/database/mongo/client.js';const db=openDatabase(':memory:');assert.equal(MONGO_SCHEMA_VERSION,10);assert.ok(db.prepare('PRAGMA table_info(billing_plan_versions)').all().some(c=>c.name==='billing_frequency'));db.close();console.log(JSON.stringify({runtime:process.version,schema:10,frequencyColumn:true}));"
for name,tag in [('candidate',candidate),('fallback',fallback)]:
 out=subprocess.check_output(['docker','run','--rm','--no-healthcheck','--network','none','--memory','256m','--cpus','0.5','-i',tag,'node','--input-type=module'],input=script)
 (r/(name+'-runtime.json')).write_bytes(out)
print(json.dumps({'candidateBuilt':True,'compatibleFallbackBuilt':True,'linuxRuntimeSmoke':True,'productionRecreated':False}))
