// Clasificación determinista: NO sustituye un modelo de IA.
const BUY = /(quiero\s+(comprar|pagar|llevar|activar|adquirir)|voy\s+a\s+(comprar|pagar)|como\s+(pago|compro)|d[oó]nde\s+pago|medios?\s+de\s+pago|env[ií]ame\s+el\s+(link|enlace)\s+de\s+pago|list[oa]\s+para\s+(comprar|pagar))/i;
const RESELLER = /(revend|distribuid|mayorist|para\s+vender|negocio\s+de\s+cuentas)/i;
const PRICE = /(precio|valor|cu[aá]nto|cuesta|tarifa|promoci[oó]n)/i;
const DELIVERY = /(disponib|stock|entrega|activaci[oó]n|c[oó]digo|garant[ií]a)/i;
const OPT_OUT = /^(stop|parar|salir|cancelar\s+mensajes|no\s+me\s+escribas|baja)$/i;
const CLEAN = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const products = ['Disney Premium','Max Platino','Amazon Prime','Paramount+','Netflix','CapCut Pro','Gemini'];
export function assess(text, lead = {}) {
  const t = String(text || '').trim();
  const lt = CLEAN(t);
  const product = products.find(p => lt.includes(CLEAN(p))) || lead.product || '';
  const wantsToBuy = BUY.test(t) || Boolean(lead.wants_to_buy);
  const reseller = RESELLER.test(t) || Boolean(lead.reseller);
  const askedPrice = PRICE.test(t) || Boolean(lead.asked_price);
  const askedDelivery = DELIVERY.test(t) || Boolean(lead.asked_delivery);
  const optedOut = OPT_OUT.test(t) || Boolean(lead.opted_out);
  // Un precio solicitado NO equivale a una compra confirmada.
  const score = optedOut ? 0 : Math.min(100, (product ? 25 : 0) + (askedPrice ? 15 : 0) + (askedDelivery ? 10 : 0) + (reseller ? 15 : 0) + (wantsToBuy ? 50 : 0));
  const stage = optedOut ? 'excluido' : product && wantsToBuy ? 'listo_para_asesor' : score >= 40 ? 'interesado' : 'nuevo';
  return {product, wants_to_buy: wantsToBuy ? 1 : 0, reseller: reseller ? 1 : 0, asked_price: askedPrice ? 1 : 0, asked_delivery: askedDelivery ? 1 : 0, opted_out: optedOut ? 1 : 0, score, stage};
}
export function templateReply(text, state, {businessName='Nexo Digital', catalog=[]}={}) {
  if(state.opted_out) return 'Entendido. No enviaremos mensajes de seguimiento. Puedes escribirnos cuando quieras.';
  if(state.stage === 'listo_para_asesor') return `Gracias por tu interés en ${state.product}. Registré tu solicitud para que un asesor confirme disponibilidad y forma de pago por este chat.`;
  if(state.product) {
    const item = catalog.find(p => CLEAN(p.name) === CLEAN(state.product));
    const price = item && item.price && item.currency ? ` Precio informado: ${item.price} ${item.currency}.` : '';
    return `¡Hola! En ${businessName} te ayudamos con ${state.product}.${price} ¿Lo necesitas para uso personal o para revender?`;
  }
  if(state.reseller) return `¡Hola! En ${businessName} atendemos revendedores. ¿Qué producto te interesa comercializar?`;
  return `¡Hola! Soy el asistente de ${businessName}. ¿Qué servicio digital estás buscando y es para ti o para revender?`;
}
