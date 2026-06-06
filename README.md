# BBTECH — Sistema de Control Bovino
## Guía de instalación y estructura del proyecto

---

## 📁 Estructura de archivos

```
bbtech/
├── index.html              ← Pantalla de login
├── app.html                ← Aplicación principal (post-login)
│
├── css/
│   ├── main.css            ← Design system: variables, botones, cards, tabla, modales
│   ├── layout.css          ← Sidebar, topbar, layout general
│   └── login.css           ← Estilos específicos del login
│
└── js/
    ├── store.js            ← Base de datos (localStorage), autenticación, operaciones de ganado
    ├── ui.js               ← Toast, Modal, helpers DOM
    ├── app.js              ← Router, sidebar dinámico, navegación
    ├── rodeo-view.js       ← Vista de planilla por rodeo/grupo
    └── rechazadas-view.js  ← Vista global de animales rechazados
```

---

## 🚀 Cómo usar en VS Code

### Opción 1 — Live Server (recomendado)
1. Instalá la extensión **Live Server** en VS Code
2. Click derecho en `index.html` → **"Open with Live Server"**
3. Se abre `http://127.0.0.1:5500/index.html`

### Opción 2 — Abrir directamente
1. Abrir `index.html` directamente en el navegador (doble click)
2. Funciona 100% sin servidor (es todo frontend estático)

---

## 🔐 Credenciales de demo

| Email                | Contraseña  |
|----------------------|-------------|
| admin@bbtech.com     | bbtech2024  |

---

## ✨ Funcionalidades implementadas

### Login
- [x] Formulario de login con validación
- [x] Mostrar/ocultar contraseña
- [x] "Recordar sesión" (7 días vs sesión de 8hs)
- [x] Rate limiting básico (5 intentos → bloqueo 30s)
- [x] Redirección automática si ya está logueado
- [x] Guard en app.html (redirige si no hay sesión)

### Sidebar
- [x] Dos estancias: El Sorteo y La Esmeralda
- [x] Subgrupos por estancia con contador de animales
- [x] Botón "+ Agregar grupo" por estancia
- [x] Link a sección Rechazadas con contador
- [x] Usuario y botón de logout

### Planilla por Rodeo/Grupo
- [x] Info general: lote (desplegable), observaciones (autosave)
- [x] Stats: Total, Preñadas, Vacías, Rechazo, % Preñez
- [x] Búsqueda por ID en tiempo real
- [x] Filtro por estado (Preñada / Vacía / Rechazo)
- [x] Tabla con: checkbox, ID, estado (select), rechazo, observación, fecha
- [x] Al marcar Vacía → pregunta si llevar a Rechazo → pide observación
- [x] Selección individual y masiva (checkAll)
- [x] Barra de acciones bulk: Rechazo / Mover / Borrar
- [x] Modal de Mover: muestra todos los grupos destino posibles
- [x] Agregar vaca individual (modal con validación de ID único)
- [x] Agregar vacas en bulk (separadas por coma/punto y coma/salto de línea)
- [x] Editar observación por vaca

### Rechazadas
- [x] Lista global de todas las vacas rechazadas
- [x] Stats: Total, Pendientes, Muerte, Venta
- [x] Filtro y búsqueda
- [x] Marcar individualmente como Muerte (rojo) o Venta (azul)
- [x] Selección y acción masiva
- [x] Muestra el origen (estancia + grupo)

### Seguridad
- [x] Content Security Policy via meta tag
- [x] Sanitización de todos los inputs antes de renderizar (anti-XSS)
- [x] Validación de formato de ID (regex)
- [x] Session tokens aleatorios (crypto.getRandomValues)
- [x] Hash de contraseña (SHA-256 + salt, vía Web Crypto API)
- [x] Guard de autenticación en app.html
- [x] Sin dependencias externas ni CDNs

---

## 🔄 Flujo de trabajo típico

```
Login → Sidebar → Seleccionar Rodeo
     → Ver info general (lote, observaciones, stats)
     → Agregar vacas (individual o bulk)
     → Marcar estados (Preñada/Vacía)
     → Vacía → opción de Rechazo + observación
     → Seleccionar múltiples → Mover / Rechazo / Borrar

Al mover Vaquillonas 15M → Rodeo 2 del Sorteo:
     → Seleccionar todas → Bulk "Mover" → elegir destino

Rechazadas:
     → Sección global
     → Marcar como Muerte o Venta
     → Seguimiento visual por color
```

---

## 💾 Datos

Toda la información se guarda en **localStorage** del navegador bajo la clave `bbtech_db`.

Para limpiar todos los datos (reset total) abrí la consola del navegador y ejecutá:
```javascript
BBT.Store.reset(); location.reload();
```

---

## 🛣 Próximas iteraciones planeadas

- [ ] Historial anual y ciclos de entore
- [ ] Pase automático de Vaquillonas 15M → Rodeo 2 y 24M → Rodeo 1
- [ ] Exportar planilla a Excel/PDF
- [ ] Múltiples usuarios con permisos por estancia
- [ ] Backend con API REST + base de datos real
- [ ] PWA para uso offline en el campo
