import { DatabaseSync } from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {assess} from './intent.mjs';
export function createStore(path=':memory:') {
  if(path !== ':memory:') mkdirSync(dirname(path),{recursive:true});
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS leads (
      phone TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', product TEXT NOT NULL DEFAULT '',
      reseller INTEGER NOT NULL DEFAULT 0, wants_to_buy INTEGER NOT NULL DEFAULT 0,
      asked_price INTEGER NOT NULL DEFAULT 0, asked_delivery INTEGER NOT NULL DEFAULT 0,
      opted_out INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'nuevo', last_message TEXT NOT NULL DEFAULT '',
      last_at TEXT NOT NULL DEFAULT '', notified INTEGER NOT NULL DEFAULT 0,
      manual_status TEXT NOT NULL DEFAULT 'pendiente'
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, phone TEXT NOT NULL, direction TEXT NOT NULL,
      text TEXT NOT NULL, created_at TEXT NOT NULL
    );`);
  const get = db.prepare('SELECT * FROM leads WHERE phone=?');
  const ins = db.prepare(`INSERT INTO messages(id,phone,direction,text,created_at) VALUES(?,?,?,?,?)`);
  const exists = db.prepare('SELECT id FROM messages WHERE id=?');
  const upsert = db.prepare(`INSERT INTO leads(phone,name,product,reseller,wants_to_buy,asked_price,asked_delivery,opted_out,score,stage,last_message,last_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(phone) DO UPDATE SET name=excluded.name,product=excluded.product,reseller=excluded.reseller,
    wants_to_buy=excluded.wants_to_buy,asked_price=excluded.asked_price,asked_delivery=excluded.asked_delivery,
    opted_out=excluded.opted_out,score=excluded.score,stage=excluded.stage,last_message=excluded.last_message,last_at=excluded.last_at`);
  return {
    db,
    getLead(phone){return get.get(phone)},
    listLeads(){return db.prepare("SELECT * FROM leads ORDER BY CASE stage WHEN 'listo_para_asesor' THEN 0 WHEN 'interesado' THEN 1 ELSE 2 END, last_at DESC").all()},
    countMessages(){return db.prepare('SELECT COUNT(*) AS n FROM messages').get().n},
    applyInbound({id,phone,name,text}) {
      if(!id || !phone || typeof text !== 'string') throw Error('Mensaje inválido');
      if(exists.get(id)) return {duplicate:true, lead:get.get(phone)};
      const prior = get.get(phone) || {};
      const evaluated = assess(text,prior);
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        ins.run(id,phone,'inbound',text,now);
        upsert.run(phone,String(name || prior.name || '').slice(0,100),evaluated.product,evaluated.reseller,evaluated.wants_to_buy,evaluated.asked_price,evaluated.asked_delivery,evaluated.opted_out,evaluated.score,evaluated.stage,text.slice(0,4000),now);
        db.exec('COMMIT');
      } catch(e) {db.exec('ROLLBACK'); throw e;}
      return {duplicate:false,lead:get.get(phone),justQualified:prior.stage !== 'listo_para_asesor' && evaluated.stage === 'listo_para_asesor'};
    },
    recordOutbound(phone,text) {ins.run(`out-${Date.now()}-${Math.random()}`,phone,'outbound',text,new Date().toISOString())},
    markNotified(phone) {db.prepare('UPDATE leads SET notified=1 WHERE phone=?').run(phone)},
    changeStatus(phone,status) {
      if(!['pendiente','contactado','vendido','perdido'].includes(status)) throw Error('Estado inválido');
      db.prepare('UPDATE leads SET manual_status=? WHERE phone=?').run(status,phone);
      return get.get(phone);
    },
  };
}
