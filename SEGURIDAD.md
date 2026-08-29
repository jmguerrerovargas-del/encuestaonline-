// ==========================================================================
// GUÍA DE SEGURIDAD Y CONFIGURACIÓN DE CREDENCIALES
// ==========================================================================
// ⚠️ ADVERTENCIA:
// Los navegadores web son entornos públicos e inseguros.
// Cualquier clave o token secreto (como Personal Access Tokens de Airtable con permisos de escritura)
// colocado en archivos JavaScript del cliente puede ser extraído por cualquier usuario o atacante.
//
// 🛡️ ARQUITECTURA RECOMENDADA:
// 1. Frontend (app.js) -> Envía datos al Webhook de n8n o a una API Serverless / Backend Proxy.
// 2. n8n / Backend -> Valida la petición y guarda en Airtable usando las credenciales seguras de servidor.
// 3. De este modo, las credenciales de Airtable NUNCA quedan expuestas al público.
//
// ==========================================================================

const SECURITY_GUIDELINES = {
  airtable_token_exposed_warning: "Si utilizaste un token real en el frontend anteriormente, debes revocarlo y generar uno nuevo inmediatamente en tu cuenta de Airtable (https://airtable.com/create/tokens).",
  n8n_integration: "Configura el nodo de Airtable dentro del flujo de n8n para que las inserciones ocurran en el servidor."
};
