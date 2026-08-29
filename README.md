# Evaluación de Experiencia y Calidad · Antigravity

Plataforma web moderna, minimalista y ultra-rápida para la recolección y análisis de retroalimentación de estudiantes en cursos y programas de formación de **Antigravity**.

---

## ✨ Características Principales

- **Diseño Cyber Magenta / Electric Violet**: Interfaz pulida con estética futurista en tonos rosa neón y violeta eléctrico, micro-animaciones, efectos de luz ambiental y tipografía optimizada (*Plus Jakarta Sans* y *Space Grotesk*).
- **Barra de Progreso Dinámica**: Indicador en tiempo real del estado de completado de la evaluación.
- **Matriz de Calificación Intuitiva**: Sistema de botones tipo píldora (1 a 5) con etiquetas descriptivas y respuesta háptica/visual instantánea.
- **Comprobante y Resumen Visual**: Pantalla de confirmación con vista detallada de las respuestas registradas y estado de sincronización.
- **Exportación de Datos**:
  - Exportación instantánea a formato **JSON**.
  - Descarga directa en **CSV** con codificación UTF-8 BOM para compatibilidad total con Microsoft Excel y Google Sheets.
- **Sincronización Multi-Canal**: Integrado con Webhook de **n8n** y soporte para base de datos en **Airtable**.

---

## 🛡️ Medidas de Seguridad Implementadas

1. **Content Security Policy (CSP)**: Cabeceras restrictivas para mitigar ataques XSS e inyecciones de código malicioso.
2. **Protección Anti-Bots (Honeypot)**: Trampa oculta para desviar envíos automáticos de bots sin afectar la experiencia de usuario.
3. **Control de Cooldown (Anti-Flood)**: Intervalo de bloqueo para prevenir envíos duplicados o ataques de saturación.
4. **Sanitización XSS y CSV Injection**:
   - Escapado estricto de entidades HTML en el renderizado del frontend.
   - Neutralización de prefijos de fórmulas DDE (`=`, `+`, `-`, `@`, `\t`, `\r`) en la exportación de archivos CSV.
5. **Arquitectura Segura de Credenciales**: No almacena secretos ni tokens de base de datos en el cliente web; delega el almacenamiento a un backend seguro (n8n).

---

## 🚀 Estructura del Proyecto

```text
├── index.html        # Estructura semántica, accesibilidad y meta-etiquetas
├── styles.css        # Sistema de diseño con variables CSS, animaciones y responsive design
├── app.js            # Lógica de validación, progreso, integraciones y exportación
├── SEGURIDAD.md      # Guía de buenas prácticas y seguridad en APIs
└── README.md         # Documentación general del repositorio
```

---

## 🌐 Despliegue Rápido (GitHub Pages)

Para publicar esta encuesta en **GitHub Pages**:
1. Dirígete a la pestaña **Settings** de este repositorio en GitHub.
2. En la sección lateral, selecciona **Pages**.
3. En **Build and deployment > Source**, selecciona `Deploy from a branch`.
4. Elige la rama `main` y la carpeta `/ (root)`.
5. Haz clic en **Save**. En unos minutos tu encuesta estará en vivo en:  
   `https://jmguerrerovargas-del.github.io/encuestaonline-/`

---

## ⚙️ Configuración de Integraciones

Edita el archivo `app.js` para conectar tus propios endpoints:

```javascript
const APP_CONFIG = {
  // Webhook de n8n o backend intermedio
  N8N_WEBHOOK_URL: 'TU_WEBHOOK_AQUI',

  // Configuración opcional de Airtable
  AIRTABLE: {
    BASE_ID: 'TU_BASE_ID',
    TABLE_ID: 'TU_TABLE_ID',
    API_TOKEN: '' // Mantener vacío en frontend por seguridad
  }
};
```

---

Desarrollado con ❤️ para los estudiantes de **Antigravity**.
