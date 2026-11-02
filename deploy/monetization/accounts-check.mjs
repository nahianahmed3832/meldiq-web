import { MongoClient } from 'mongodb';
import crypto from 'node:crypto';
const client = new MongoClient(process.env.MONGODB_URI,{maxPoolSize:1,serverSelectionTimeoutMS:10000});
try {
 await client.connect();const db=client.db(process.env.MONGODB_DB||'meldiq');
 const fields=['id','user_id','email','name','password_hash','email_verified_at','legacy_linked_at'];
 const rows=await db.collection('accounts').find({},{projection:Object.fromEntries(fields.map(k=>[k,1]))}).toArray();
 const accounts=Object.fromEntries(rows.map(a=>[a.id,crypto.createHash('sha256').update(JSON.stringify(fields.map(k=>a[k]??null))).digest('hex')]));
 const schema=await db.collection('orbit_meta').findOne({_id:'schema'});
 console.log(JSON.stringify({accounts,count:rows.length,schema:schema?.version,domains:process.env.MONGODB_DOMAINS,databaseMode:process.env.DATABASE_MODE}));
} finally {await client.close();}
