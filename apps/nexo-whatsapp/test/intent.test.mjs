import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,templateReply} from '../lib/intent.mjs';
import {createStore} from '../lib/db.mjs';
test('interés por precio no se convierte en venta lista',()=>{
  assert.equal(assess('precio de Disney Premium').stage,'interesado');
  assert.equal(assess('precio de Disney Premium').wants_to_buy,0);
});
test('intención concreta + servicio => listo para asesor',()=>{
  assert.equal(assess('Quiero comprar Disney Premium').stage,'listo_para_asesor');
});
test('opt-out inhibe lead caliente',()=>{
  assert.equal(assess('STOP',{wants_to_buy:1,product:'Netflix'}).stage,'excluido');
});
test('deduplicación de webhook',()=>{
  const s=createStore(); const m={id:'wamid.1',phone:'573001111111',name:'Cliente',text:'quiero comprar Max Platino'};
  assert.equal(s.applyInbound(m).duplicate,false);
  assert.equal(s.applyInbound(m).duplicate,true);
  assert.equal(s.countMessages(),1);
  assert.equal(s.getLead(m.phone).stage,'listo_para_asesor');
  assert.match(templateReply('',s.getLead(m.phone),{}),/asesor/);
  s.db.close();
});
