# Evolución propuesta: Nexo CRM Agentic

**Base estudiada:** trycompai/crm, rama release, tag v1.16.0 (2026-10-22).

## Flujo comercial buscado
Cliente inicia conversación en WhatsApp → Meta Cloud API → webhook verificado → persistencia y deduplicación → agente recepción → consulta de catálogo vigente → clasificación con evidencia → respuesta dentro de ventana autorizada → si solicita comprar, asignación humana y aviso al dueño → registro de venta solo después de validación manual.

## Roles de agentes en la evolución completa
- **Recepción:** identifica el producto y si es compra directa/reventa.
- **Asesor de catálogo:** consulta precios y disponibilidad confirmados; no inventa datos.
- **Calificador:** separa interés superficial, necesidad concreta e intención explícita de pago.
- **Coordinador:** transfiere prospectos listos al operador y desactiva respuestas automáticas.
- **Seguimiento:** solo con consentimiento y plantillas autorizadas cuando corresponda; presupuesto y límite por contacto.

## Reutilizar del upstream
- `apps/app`: UI Next.js, autenticación, tablas.
- `apps/api`: NestJS, tRPC, autenticación y autorización.
- `apps/agent`: cola duradera y habilidades de agentes.
- `packages/db`: migraciones Prisma/Postgres.
- `packages/ui`: componentes de interfaz.

## No confundir
- El software base tiene agentes autónomos de investigación y tareas; NO trae, por el hecho de hacer Fork, el conector oficial de WhatsApp, una venta cerrada o un bot configurado.
- La demostración v0.1 es una prueba aislada; para integrar plenamente con Comp AI hay que agregar migraciones, controladores y un canal nuevo.
- El hosting 24/7 y los mensajes de Meta/IA podrían generar costos; no prometer costo cero.
