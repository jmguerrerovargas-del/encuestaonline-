// ==========================================================================
// CONFIGURACIÓN DE INTEGRACIONES Y SEGURIDAD
// ==========================================================================
// NOTA DE SEGURIDAD:
// Nunca almacenes tokens secretos (como Airtable Personal Access Tokens con permisos de escritura)
// en archivos JavaScript públicos del lado del cliente.
// La vía recomendada y segura es canalizar las solicitudes a través del Webhook de n8n o un backend proxy,
// donde las credenciales residen protegidas en variables de entorno seguras.

const APP_CONFIG = {
  // Webhook de n8n (seguro para el frontend, procesa datos y gestiona Airtable/emails en servidor)
  N8N_WEBHOOK_URL: 'https://juanmanuel2026.app.n8n.cloud/webhook/7def99af-54f1-49e5-88f7-b42868abb5dd',
  
  // Configuración de Airtable
  // Si deseas sincronización directa adicional para pruebas locales, define el token aquí
  // o preferiblemente canalízalo mediante n8n para no exponer credenciales al usuario final.
  AIRTABLE: {
    BASE_ID: 'appFxmbzkGf3nKBDu',
    TABLE_ID: 'tbl7bt9ZvVejPIUbX',
    // Mantener vacío en frontend de producción para prevenir robo de credenciales:
    API_TOKEN: '', 
    get ENDPOINT() {
      return `https://api.airtable.com/v0/${this.BASE_ID}/${this.TABLE_ID}`;
    }
  },

  // Límites de validación y seguridad
  SECURITY: {
    MAX_ID_LENGTH: 80,
    MAX_COMMENT_LENGTH: 500,
    SUBMISSION_COOLDOWN_MS: 3000 // Previene envíos múltiples accidentales o spam
  }
};

const STORAGE_KEY = 'antigravity_survey_receipts_v2';
let lastSubmissionTime = 0;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('survey-form');
  const idInput = document.getElementById('id_estudiante');
  const commentsInput = document.getElementById('comentarios_adicionales');
  const charCountEl = document.getElementById('char-count');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const submitBtn = document.getElementById('submit-btn');
  const honeypotInput = document.getElementById('survey_hp_company');
  
  const successView = document.getElementById('success-view');
  const receiptCard = document.getElementById('receipt-card');
  const airtableSyncContainer = document.getElementById('airtable-sync-container');
  const btnRestart = document.getElementById('btn-restart');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnExportCsvDirect = document.getElementById('btn-export-csv-direct');
  const totalRecordsEl = document.getElementById('total-records-count');

  // Actualizar contador y progreso inicial
  updateStoredCount();
  updateProgress();

  // Contador de caracteres para el textarea
  if (commentsInput && charCountEl) {
    commentsInput.addEventListener('input', () => {
      const currentLen = Math.min(commentsInput.value.length, APP_CONFIG.SECURITY.MAX_COMMENT_LENGTH);
      charCountEl.textContent = currentLen;
    });
  }

  // Escuchar cambios en inputs de texto para actualizar progreso y remover errores
  idInput.addEventListener('input', () => {
    clearBlockError('block-id_estudiante');
    updateProgress();
  });

  // Escuchar cambios en todos los radio buttons
  const allRadios = form.querySelectorAll('input[type="radio"]');
  allRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      clearBlockError(`block-${radio.name}`);
      updateProgress();
    });
  });

  // ==========================================================================
  // CÁLCULO DE BARRA DE PROGRESO DINÁMICA
  // ==========================================================================
  function updateProgress() {
    const totalRequired = 4;
    let completed = 0;

    // 1. Check ID Estudiante
    if (idInput.value.trim().length > 0) completed++;

    // 2. Check Nivel Satisfacción
    if (form.querySelector('input[name="nivel_satisfaccion"]:checked')) completed++;

    // 3. Check Claridad Contenido
    if (form.querySelector('input[name="claridad_contenido"]:checked')) completed++;

    // 4. Check Aplicabilidad Práctica
    if (form.querySelector('input[name="aplicabilidad_practica"]:checked')) completed++;

    const percent = Math.round((completed / totalRequired) * 100);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
  }

  // ==========================================================================
  // ENVÍO A AIRTABLE (Directo solo si hay API_TOKEN configurado, de lo contrario gestionado por n8n)
  // ==========================================================================
  async function sendToAirtable(data) {
    // Si no hay token de cliente configurado, se delega de forma segura a n8n
    if (!APP_CONFIG.AIRTABLE.API_TOKEN) {
      return { skipped: true, message: 'Delegado de forma segura a n8n' };
    }

    const payload = {
      fields: {
        'Identificador_de_Alumno': data.id_estudiante,
        'Nivel_de_Satisfacción': data.nivel_satisfaccion,
        'Claridad_Contenido': data.claridad_contenido,
        'Aplicabilidad_Práctica': data.aplicabilidad_practica,
        'Comentarios_Adicionales': data.comentarios_adicionales
      }
    };

    const response = await fetch(APP_CONFIG.AIRTABLE.ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APP_CONFIG.AIRTABLE.API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return await response.json();
  }

  // ==========================================================================
  // ENVÍO AL WEBHOOK DE N8N (ENVÍO SEGURO Y PROCESAMIENTO BACKEND)
  // ==========================================================================
  async function sendToN8n(data) {
    const payload = {
      id_estudiante: data.id_estudiante,
      nivel_satisfaccion: data.nivel_satisfaccion,
      claridad_contenido: data.claridad_contenido,
      aplicabilidad_practica: data.aplicabilidad_practica,
      comentarios_adicionales: data.comentarios_adicionales,
      timestamp: data.timestamp,
      formatted_date: data.formatted_date
    };

    const response = await fetch(APP_CONFIG.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`n8n respondió con error ${response.status}: ${errorText.substring(0, 100)}`);
    }

    return await response.json().catch(() => ({ status: 'success' }));
  }

  // ==========================================================================
  // ENVÍO Y VALIDACIÓN DEL FORMULARIO
  // ==========================================================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Detección de Bots por Honeypot
    if (honeypotInput && honeypotInput.value.trim() !== '') {
      console.warn('Bot detectado mediante Honeypot. Envío descartado.');
      return;
    }

    // 2. Control de Cooldown (Anti-spam / Anti-double-click)
    const now = Date.now();
    if (now - lastSubmissionTime < APP_CONFIG.SECURITY.SUBMISSION_COOLDOWN_MS) {
      return;
    }

    // 3. Validación estricta
    const isValid = validateSurvey();
    if (!isValid) {
      const firstError = form.querySelector('.question-block.has-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    lastSubmissionTime = now;

    // 4. Extracción y Sanitización de datos
    const formData = new FormData(form);
    const rawId = (formData.get('id_estudiante') || '').trim();
    const rawComments = (formData.get('comentarios_adicionales') || '').trim();

    // Sanitización de longitud y tipos
    const surveyPayload = {
      id_estudiante: rawId.substring(0, APP_CONFIG.SECURITY.MAX_ID_LENGTH),
      nivel_satisfaccion: Math.min(5, Math.max(1, parseInt(formData.get('nivel_satisfaccion'), 10) || 0)),
      claridad_contenido: Math.min(5, Math.max(1, parseInt(formData.get('claridad_contenido'), 10) || 0)),
      aplicabilidad_practica: Math.min(5, Math.max(1, parseInt(formData.get('aplicabilidad_practica'), 10) || 0)),
      comentarios_adicionales: rawComments.substring(0, APP_CONFIG.SECURITY.MAX_COMMENT_LENGTH) || 'Sin observaciones adicionales',
      timestamp: new Date().toISOString(),
      formatted_date: new Date().toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    };

    // Estado de carga en el botón de envío
    setSubmitLoading(true);

    // Envíos concurrentes protegidos
    const tasks = [sendToN8n(surveyPayload)];
    if (APP_CONFIG.AIRTABLE.API_TOKEN) {
      tasks.push(sendToAirtable(surveyPayload));
    }

    const results = await Promise.allSettled(tasks);
    setSubmitLoading(false);

    const n8nResult = results[0];
    const airtableResult = APP_CONFIG.AIRTABLE.API_TOKEN ? results[1] : null;

    const n8nOk = n8nResult.status === 'fulfilled';
    const airtableOk = airtableResult ? (airtableResult.status === 'fulfilled') : true;

    // Guardar respuesta localmente como comprobante
    surveyPayload.airtable_synced = airtableOk;
    surveyPayload.n8n_synced = n8nOk;
    saveResponse(surveyPayload);

    // Mostrar vista de éxito con estado de ambas integraciones
    renderSuccess(surveyPayload, {
      airtableOk: airtableOk,
      n8nOk: n8nOk,
      airtableSkipped: !APP_CONFIG.AIRTABLE.API_TOKEN,
      airtableError: (airtableResult && airtableResult.status === 'rejected') ? (airtableResult.reason?.message || 'Error') : null,
      n8nError: !n8nOk ? (n8nResult.reason?.message || 'Error n8n') : null
    });
  });

  function setSubmitLoading(isLoading) {
    if (!submitBtn) return;
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalContent = submitBtn.innerHTML;
      submitBtn.innerHTML = `
        <span class="btn-spinner"></span>
        <span class="btn-caption">Procesando y enviando de forma segura...</span>
      `;
    } else {
      submitBtn.disabled = false;
      if (submitBtn.dataset.originalContent) {
        submitBtn.innerHTML = submitBtn.dataset.originalContent;
      }
    }
  }

  function validateSurvey() {
    let valid = true;
    const cleanId = idInput.value.trim();

    // Validar ID (longitud máxima y caracteres no vacíos)
    if (!cleanId || cleanId.length > APP_CONFIG.SECURITY.MAX_ID_LENGTH) {
      setBlockError('block-id_estudiante');
      valid = false;
    } else {
      clearBlockError('block-id_estudiante');
    }

    // Validar Escalas Obligatorias (valores 1..5)
    const scaleFields = ['nivel_satisfaccion', 'claridad_contenido', 'aplicabilidad_practica'];
    scaleFields.forEach(fieldName => {
      const checked = form.querySelector(`input[name="${fieldName}"]:checked`);
      const val = checked ? parseInt(checked.value, 10) : 0;
      if (!checked || isNaN(val) || val < 1 || val > 5) {
        setBlockError(`block-${fieldName}`);
        valid = false;
      } else {
        clearBlockError(`block-${fieldName}`);
      }
    });

    return valid;
  }

  function setBlockError(blockId) {
    const el = document.getElementById(blockId);
    if (el) el.classList.add('has-error');
  }

  function clearBlockError(blockId) {
    const el = document.getElementById(blockId);
    if (el) el.classList.remove('has-error');
  }

  // ==========================================================================
  // RENDERIZADO DE ÉXITO Y RECIBO (XSS-Safe)
  // ==========================================================================
  function renderSuccess(data, syncStatus = {}) {
    form.classList.add('hidden');

    // Insignias de sincronización
    if (airtableSyncContainer) {
      let badgesHtml = '<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-bottom: 1.25rem;">';
      
      // Badge n8n / Backend
      if (syncStatus.n8nOk) {
        badgesHtml += `
          <div class="airtable-sync-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <span>Procesado por n8n (Seguro)</span>
          </div>
        `;
      } else {
        badgesHtml += `
          <div class="airtable-sync-badge error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Error n8n (${escapeHTML(syncStatus.n8nError || 'No respondió')})</span>
          </div>
        `;
      }

      // Badge Airtable
      if (syncStatus.airtableSkipped) {
        badgesHtml += `
          <div class="airtable-sync-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Airtable protegido vía Backend</span>
          </div>
        `;
      } else if (syncStatus.airtableOk) {
        badgesHtml += `
          <div class="airtable-sync-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Guardado en Airtable</span>
          </div>
        `;
      } else {
        badgesHtml += `
          <div class="airtable-sync-badge error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Airtable (${escapeHTML(syncStatus.airtableError || 'Error')})</span>
          </div>
        `;
      }

      badgesHtml += '</div>';
      airtableSyncContainer.innerHTML = badgesHtml;
    }

    const safeId = escapeHTML(data.id_estudiante);
    const safeComments = escapeHTML(data.comentarios_adicionales);
    const safeSatisfaccion = parseInt(data.nivel_satisfaccion, 10) || 0;
    const safeClaridad = parseInt(data.claridad_contenido, 10) || 0;
    const safeAplicabilidad = parseInt(data.aplicabilidad_practica, 10) || 0;

    receiptCard.innerHTML = `
      <div class="receipt-item">
        <span class="receipt-key">Identificador:</span>
        <span class="receipt-val">${safeId}</span>
      </div>
      <div class="receipt-item">
        <span class="receipt-key">Satisfacción General:</span>
        <span class="receipt-val">
          <span class="score-badge">${safeSatisfaccion}/5</span>
          ${getScoreLabel('satisfaccion', safeSatisfaccion)}
        </span>
      </div>
      <div class="receipt-item">
        <span class="receipt-key">Claridad del Contenido:</span>
        <span class="receipt-val">
          <span class="score-badge">${safeClaridad}/5</span>
          ${getScoreLabel('claridad', safeClaridad)}
        </span>
      </div>
      <div class="receipt-item">
        <span class="receipt-key">Aplicabilidad Práctica:</span>
        <span class="receipt-val">
          <span class="score-badge">${safeAplicabilidad}/5</span>
          ${getScoreLabel('aplicabilidad', safeAplicabilidad)}
        </span>
      </div>
      <div class="receipt-item" style="flex-direction: column; align-items: flex-start; gap: 0.35rem;">
        <span class="receipt-key">Comentarios:</span>
        <span class="receipt-val" style="font-weight: 400; color: var(--text-secondary); font-style: italic;">
          "${safeComments}"
        </span>
      </div>
    `;

    successView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getScoreLabel(type, val) {
    const maps = {
      satisfaccion: { 1: '😞 Muy insatisfecho', 2: '🙁 Insatisfecho', 3: '😐 Neutral', 4: '😊 Satisfecho', 5: '🤩 Muy satisfecho' },
      claridad: { 1: '🌫️ Muy poco claro', 2: '🤔 Poco claro', 3: '👌 Aceptable', 4: '💡 Claro', 5: '✨ Muy claro' },
      aplicabilidad: { 1: '🚫 Nada aplicable', 2: '📉 Poco aplicable', 3: '⚖️ Moderada', 4: '🛠️ Muy aplicable', 5: '🚀 Totalmente' }
    };
    return maps[type] ? (maps[type][val] || '') : '';
  }

  // ==========================================================================
  // BOTONES POST-REGISTRO Y REINICIO
  // ==========================================================================
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      form.reset();
      if (charCountEl) charCountEl.textContent = '0';
      if (airtableSyncContainer) airtableSyncContainer.innerHTML = '';
      successView.classList.add('hidden');
      form.classList.remove('hidden');
      updateProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const responses = getStoredResponses();
      if (!responses.length) {
        alert('Aún no hay comprobantes guardados en esta sesión.');
        return;
      }
      const blob = new Blob([JSON.stringify(responses, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `antigravity_encuestas_${Date.now()}.json`);
    });
  }

  if (btnExportCsvDirect) {
    btnExportCsvDirect.addEventListener('click', () => {
      const responses = getStoredResponses();
      if (!responses.length) {
        alert('Aún no hay respuestas guardadas.');
        return;
      }
      const csvContent = convertToCsv(responses);
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `antigravity_encuestas_${Date.now()}.csv`);
    });
  }

  // ==========================================================================
  // STORAGE & EXPORT HELPERS CON PROTECCIÓN CONTRA CSV INJECTION
  // ==========================================================================
  function getStoredResponses() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveResponse(item) {
    const list = getStoredResponses();
    list.push(item);
    try {
      // Guardar en sessionStorage para proteger la privacidad en ordenadores compartidos
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      updateStoredCount();
    } catch (e) {
      console.error('Error al guardar comprobante:', e);
    }
  }

  function updateStoredCount() {
    const count = getStoredResponses().length;
    if (totalRecordsEl) {
      totalRecordsEl.textContent = count;
    }
  }

  // Previene inyecciones de fórmulas (CSV Injection / Formula Injection DDE en Excel/Sheets)
  function sanitizeCsvField(field) {
    let str = String(field ?? '');
    // Si la cadena comienza con caracteres que Excel/Calc interpretan como fórmulas (=, +, -, @, tab, retorno),
    // se antepone un apóstrofe para neutralizar la ejecución.
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  }

  function convertToCsv(items) {
    if (!items.length) return '';
    const headers = ['id_estudiante', 'nivel_satisfaccion', 'claridad_contenido', 'aplicabilidad_practica', 'comentarios_adicionales', 'timestamp', 'airtable_synced'];
    const rows = items.map(r => [
      sanitizeCsvField(r.id_estudiante),
      parseInt(r.nivel_satisfaccion, 10) || 0,
      parseInt(r.claridad_contenido, 10) || 0,
      parseInt(r.aplicabilidad_practica, 10) || 0,
      sanitizeCsvField(r.comentarios_adicionales),
      sanitizeCsvField(r.timestamp),
      r.airtable_synced ? 'true' : 'false'
    ]);
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Sanitizador XSS robusto (escapa &, <, >, ", ', y backticks)
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/`/g, '&#96;');
  }
});
