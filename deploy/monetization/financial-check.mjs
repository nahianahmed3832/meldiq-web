import {MongoClient} from 'mongodb';
import crypto from 'node:crypto';
// Private comparison only: never publish account, financial or provider references.
const client=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:1,serverSelectionTimeoutMS:10000});
try {
 await client.connect(); const db=client.db(process.env.MONGODB_DB||'meldiq');
 const out={};
 const tables=['billing_plans','billing_plan_versions','billing_customers','billing_checkouts','billing_subscriptions','billing_subscription_history','billing_invoices','billing_grants','billing_play_purchases','billing_payment_methods','billing_card_mandates','billing_commerce_orders','mojo_gifts','mojo_gift_credits'];
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'&&v.constructor===Object?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 for(const name of tables){
  out[name]={};
  for(const row of await db.collection(name).find({}).toArray()){
   // The additive migration explicitly materializes this historical default.
   if(name==='billing_plan_versions'&&row.billing_frequency===1)delete row.billing_frequency;
   out[name][String(row._id)]=crypto.createHash('sha256').update(JSON.stringify(canonical(row))).digest('hex');
  }
 }
 console.log(JSON.stringify(out));
} finally {await client.close();}
