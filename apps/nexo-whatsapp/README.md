# Nexo CRM — Puente WhatsApp y Leads (prototipo v0.1)

Complemento **aditivo** para copiar en el fork de `trycompai/crm` (rama `release`, versión auditada v1.16.0). **No** sobrescribe ni sustituye el CRM original y **todavía no sincroniza sus modelos Prisma**: presenta su propia bandeja provisional y almacena datos en SQLite local. Pensado para probar desde el navegador Android con Codespaces y sin usar el número real.

## Incluye
- Bandeja móvil de leads, etapas, seguimiento y botón «Abrir WhatsApp».
- Simulador de mensajes para probar sin Meta ni gastar dinero.
- Clasificador determinista de intención; nunca considera «¿cuánto cuesta?» como pago confirmado.
- Agente conversacional opcional mediante Gemini API; sin clave responde con reglas.
- Webhook GET/POST de WhatsApp Cloud API, verificación de firma HMAC, deduplicación por id.
- Mensaje de respuesta al cliente cuando llega texto, si Meta está configurado.
- Alerta opcional al propietario con **plantilla aprobada** (3 parámetros: nombre, producto, teléfono).
- Pruebas unitarias, configuración protegida y lista de trabajo para integrar con Comp AI CRM.

## Probar desde Android
1. En GitHub haz **Fork** a `trycompai/crm` y conserva rama `release`.
2. Agrega la carpeta `apps/nexo-whatsapp/` de este kit a tu fork. Alternativa: desde GitHub Codespaces, crea esa ruta y sube los archivos.
3. En la terminal del Codespace (se abre en navegador Android):
   ```bash
   cd apps/nexo-whatsapp
   cp .env.example .env
   ```
4. Edita `.env` y cambia `ADMIN_PASSWORD` a una clave fuerte de mínimo 12 caracteres (debe ser secreta).
5. Ejecuta:
   ```bash
   npm test
   npm start
   ```
6. Abre la pestaña `Ports` del Codespace, puerto **3005**, y selecciona abrir en el navegador. Inicia sesión con `admin` y tu contraseña. Usa el simulador.

**Ojo:** Codespaces sirve para pruebas, NO para mantener un bot funcionando las 24 horas. Se detiene cuando está inactivo. Para producción necesitarás hosting persistente, HTTPS, backup, control de gastos y una cola de trabajos.

## Conectar WhatsApp real — después de probar
1. Usa **WhatsApp Business Platform / Cloud API** oficial en Meta, no clones ni bibliotecas de automatización no autorizadas.
2. Comprueba que tu número puede usar la API sin perder el acceso a la app; la compatibilidad/coexistencia depende de la cuenta y proveedor.
3. Configura `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID` y versión vigente de `META_GRAPH_VERSION` en **variables del hosting**, jamás en GitHub.
4. En la consola Meta configura webhook `https://tu-servidor.com/webhook/whatsapp`, con el verify token; suscribe eventos de mensajes. Esta aplicación verifica `X-Hub-Signature-256`.
5. Para enviar el aviso automático al dueño configura `OWNER_PHONE` y `HOT_LEAD_TEMPLATE`, una plantilla aprobada por Meta con tres variables en cuerpo; no se envía nada si está vacía. Recuerda que existen costes de Meta por mensajes y condiciones de la ventana de atención.
6. Si quieres modelo IA, agrega `GEMINI_API_KEY`; el modo de reglas funciona sin la clave.

## Límites de esta fase
- Solo admite mensajes entrantes de texto. No maneja notas de voz, fotos ni catálogos de Meta.
- La primera lógica de clasificación usa reglas; con `GEMINI_API_KEY` se añade generación conversacional de IA. La IA no toma pagos ni asegura inventario.
- No importa conversaciones antiguas del WhatsApp Business del teléfono.
- No reemplaza la base de datos PostgreSQL del CRM original, ni modifica el front end original. Es una **primera modificación aditiva**, aislada para no romper el sistema base.
- SQLite integrado en Node 22 sigue marcado experimental; en producción migrar a Prisma/Postgres.
- **Webhook prototipo:** confirma recepción HTTP antes de procesar; para producción, usar cola durable/reintentos porque un reinicio puede perder eventos.
- No usar en producción sin mejorar gestión de secretos, autorización por roles, CSRF, cifrado/retención de datos y auditoría de conversaciones.

## Evolución siguiente en CRM original
1. Prisma: añadir `WhatsAppConversation`, `WhatsAppMessage`, `LeadQualification` y un índice único para `wamid`.
2. NestJS API: recibir eventos de Meta, validar firma y encolar tareas; exponer consultas para panel.
3. `apps/agent`: herramientas de catálogo, cualificación, transferencia a humano y seguimiento con presupuesto máximo.
4. `apps/app`: nueva pestaña **WhatsApp Ventas** con filtros «Nuevo / Interesado / Listo / Vendido».
5. Pruebas: cobros falsos, prompts adversariales, duplicados de webhooks, alta carga, caducidad de 24h, opt-out, auditar cifras.

Repositorio original: https://github.com/trycompai/crm  · Licencia MIT. Conserva el archivo LICENSE y avisos originales.
