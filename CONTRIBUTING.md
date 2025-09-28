# 🤝 Guía de Contribución - Fisioterapia Gossos

¡Gracias por tu interés en contribuir a **Fisioterapia Gossos**! Esta guía te ayudará a participar efectivamente en el desarrollo del proyecto.

## 📋 Tabla de Contenidos

- [Código de Conducta](#-código-de-conducta)
- [Cómo Contribuir](#-cómo-contribuir)
- [Configuración del Entorno](#-configuración-del-entorno)
- [Convenciones de Desarrollo](#-convenciones-de-desarrollo)
- [Proceso de Pull Request](#-proceso-de-pull-request)
- [Reportar Bugs](#-reportar-bugs)
- [Solicitar Funcionalidades](#-solicitar-funcionalidades)
- [Documentación](#-documentación)

## 📜 Código de Conducta

### Nuestro Compromiso

En el interés de fomentar un ambiente abierto y acogedor, como contribuidores y mantenedores nos comprometemos a hacer de la participación en nuestro proyecto una experiencia libre de acoso para todos.

### Estándares

Ejemplos de comportamiento que contribuyen a crear un ambiente positivo:

✅ **Permitido:**
- Usar lenguaje inclusivo y respetuoso
- Respetar diferentes puntos de vista y experiencias
- Aceptar críticas constructivas
- Enfocarse en lo que es mejor para la comunidad
- Mostrar empatía hacia otros miembros

❌ **No Permitido:**
- Uso de lenguaje o imágenes sexualizadas
- Comentarios despectivos o ataques personales
- Acoso público o privado
- Publicar información privada sin permiso
- Otras conductas no profesionales

### Aplicación

Los casos de comportamiento abusivo pueden ser reportados contactando al equipo del proyecto en **dev@fisioterapiagossos.com**. Todas las quejas serán revisadas e investigadas.

## 🚀 Cómo Contribuir

### Tipos de Contribuciones Bienvenidas

- **🐛 Corrección de bugs**
- **✨ Nuevas funcionalidades**
- **📚 Mejoras de documentación**
- **🎨 Mejoras de UI/UX**
- **⚡ Optimizaciones de rendimiento**
- **🧪 Tests y validación**
- **🌐 Traducciones**

### Antes de Empezar

1. **Revisa los issues existentes** para evitar trabajo duplicado
2. **Discute cambios grandes** creando un issue primero
3. **Lee toda esta guía** antes de hacer tu primera contribución
4. **Configura tu entorno** siguiendo las instrucciones

## 🛠️ Configuración del Entorno

### Prerequisitos

- **Node.js** 18+ ([Descargar](https://nodejs.org/))
- **Git** ([Descargar](https://git-scm.com/))
- **Cuenta GitHub** ([Crear](https://github.com/join))
- **Cuenta Supabase** ([Crear gratis](https://supabase.com/))

### Configuración Inicial

```bash
# 1. Fork del repositorio en GitHub
# Ir a https://github.com/tu-usuario/fisioterapia-gossos y hacer click en "Fork"

# 2. Clonar tu fork
git clone https://github.com/TU-USUARIO/fisioterapia-gossos.git
cd fisioterapia-gossos

# 3. Agregar remote upstream
git remote add upstream https://github.com/USUARIO-ORIGINAL/fisioterapia-gossos.git

# 4. Verificar remotes
git remote -v
# origin    https://github.com/TU-USUARIO/fisioterapia-gossos.git (fetch)
# origin    https://github.com/TU-USUARIO/fisioterapia-gossos.git (push)
# upstream  https://github.com/USUARIO-ORIGINAL/fisioterapia-gossos.git (fetch)
# upstream  https://github.com/USUARIO-ORIGINAL/fisioterapia-gossos.git (push)

# 5. Instalar dependencias
npm install

# 6. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# 7. Ejecutar en desarrollo
npm run dev
```

### Verificar Configuración

```bash
# Verificar que todo funciona
npm run dev

# En otro terminal, ejecutar tests (cuando estén disponibles)
npm test

# Verificar linting
npm run lint
```

## 📝 Convenciones de Desarrollo

### Estructura de Branches

```
main                    # Producción estable - NUNCA tocar directamente
├── develop            # Rama de desarrollo - base para features
├── feature/auth-improvements    # Nueva funcionalidad
├── feature/booking-ui-update   # Mejora de interfaz
├── fix/calendar-bug           # Corrección de bug
├── docs/api-update           # Actualización de documentación
└── hotfix/urgent-security    # Arreglo urgente para main
```

### Convención de Nombres de Branches

```bash
# FEATURES (nuevas funcionalidades)
feature/auth-google-login
feature/booking-recurring
feature/admin-analytics
feature/client-notifications
feature/payment-stripe
feature/dog-medical-history

# FIXES (corrección de bugs)
fix/booking-time-conflict
fix/mobile-calendar-display
fix/email-template-spanish
fix/pwa-install-button
fix/auth-session-timeout

# IMPROVEMENTS (mejoras de funcionalidades existentes)
improve/booking-ux
improve/admin-dashboard-performance
improve/mobile-navigation
improve/error-handling

# DOCS (documentación)
docs/api-endpoints
docs/deployment-guide
docs/contributing-spanish
docs/troubleshooting-update

# HOTFIX (arreglos urgentes para producción)
hotfix/security-auth-bypass
hotfix/booking-creation-failure
```

### Convención de Commits

Usamos **Conventional Commits** con tipos específicos para el proyecto:

```bash
# FORMATO
tipo(área): descripción corta en presente

# TIPOS PERMITIDOS
feat      # Nueva funcionalidad
fix       # Corrección de bug
improve   # Mejora de funcionalidad existente
docs      # Cambios en documentación
style     # Cambios de formato (espacios, puntos y comas, etc)
refactor  # Refactoring de código sin cambiar funcionalidad
perf      # Mejoras de rendimiento
test      # Añadir o corregir tests
build     # Cambios en el sistema de build
ci        # Cambios en configuración de CI
chore     # Mantenimiento (actualizar dependencias, etc)

# ÁREAS ESPECÍFICAS
auth      # Sistema de autenticación
booking   # Sistema de reservas
admin     # Panel de administración
client    # Dashboard de cliente
ui        # Interfaz de usuario
api       # API y backend
db        # Base de datos
pwa       # Progressive Web App
email     # Sistema de emails
calendar  # Componentes de calendario
```

### Ejemplos de Commits Correctos

```bash
# ✅ CORRECTO
feat(booking): agregar validación de horarios en tiempo real
fix(auth): resolver error de timeout en login
improve(ui): mejorar responsive del calendario en móviles
docs(api): actualizar documentación de endpoints de reservas
perf(booking): optimizar consulta de disponibilidad de horarios
style(admin): ajustar espaciado en panel de configuración

# ❌ INCORRECTO
- "cambios varios"
- "fix bug"
- "update"
- "mejoras"
- "WIP"
- "fixed stuff"
```

### Estándares de Código

#### JavaScript/JSX

```javascript
// ✅ CORRECTO - Nombres descriptivos
const loadAvailableTimeSlots = async (date, serviceId) => {
  try {
    const { data, error } = await supabase
      .from('available_time_slots')
      .select('*')
      .eq('date', date)
    
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error loading time slots:', error)
    throw error
  }
}

// ✅ CORRECTO - Componentes funcionales con hooks
const BookingForm = ({ onSubmit, selectedService }) => {
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(false)
  
  return (
    <form onSubmit={onSubmit}>
      {/* JSX content */}
    </form>
  )
}

// ❌ INCORRECTO - Nombres no descriptivos
const fn = async (d, s) => { /* ... */ }
const getData = () => { /* muy genérico */ }
```

#### CSS/Tailwind

```jsx
// ✅ CORRECTO - Clases organizadas y responsivas
<div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-white rounded-lg shadow-sm border">
  <h3 className="text-lg font-semibold text-gray-900">Título</h3>
  <button className="btn btn-primary">Acción</button>
</div>

// ❌ INCORRECTO - Clases desordenadas y sin responsive
<div className="bg-white p-4 flex text-lg shadow-sm border rounded-lg">
  {/* Sin consideración móvil */}
</div>
```

### Estilo de Archivos

```bash
# Nombres de archivos en PascalCase para componentes
BookingForm.jsx
AdminDashboard.jsx
ClientNavigation.jsx

# Nombres en camelCase para utilidades
bookingUtils.js
dateHelpers.js
authUtils.js

# Nombres en kebab-case para páginas y assets
booking-page.jsx
reset-password.jsx
user-avatar.png
```

## 🔄 Proceso de Pull Request

### 1. Preparación

```bash
# Asegurarse de estar actualizado
git checkout develop
git pull upstream develop

# Crear nueva branch desde develop
git checkout -b feature/mi-nueva-funcionalidad

# Verificar branch correcta
git branch
```

### 2. Desarrollo

```bash
# Hacer cambios y commits frecuentes
git add .
git commit -m "feat(booking): agregar validación básica"

# Más cambios...
git add .
git commit -m "feat(booking): agregar interfaz de usuario"

# Push a tu fork
git push origin feature/mi-nueva-funcionalidad
```

### 3. Crear Pull Request

1. **Ir a GitHub** y navegar a tu fork
2. **Click "Compare & Pull Request"**
3. **Llenar el template:**

```markdown
## 🎯 Descripción

Descripción clara de qué hace este PR y por qué es necesario.

## 🔗 Issue Relacionado

Closes #123

## 🧪 Tipo de Cambio

- [ ] 🐛 Corrección de bug
- [ ] ✨ Nueva funcionalidad
- [ ] 💥 Breaking change
- [ ] 📚 Actualización de documentación
- [ ] ⚡ Mejora de rendimiento
- [ ] 🎨 Mejora de UI/UX

## 🧪 Cómo Probar

1. Paso 1: Navegar a...
2. Paso 2: Hacer click en...
3. Paso 3: Verificar que...

## 📸 Screenshots (si es cambio de UI)

### Antes
![Antes](url-imagen-antes)

### Después  
![Después](url-imagen-después)

## ✅ Checklist

- [ ] Mi código sigue las convenciones del proyecto
- [ ] He revisado mi propio código
- [ ] He comentado mi código en áreas difíciles
- [ ] He hecho cambios correspondientes en la documentación
- [ ] Mis cambios no generan nuevas advertencias
- [ ] He añadido tests que prueban mi fix/feature
- [ ] Tests nuevos y existentes pasan localmente
- [ ] He probado en diferentes navegadores
- [ ] He probado en dispositivos móviles
```

### 4. Revisión y Merge

- **Esperar revisión** del equipo
- **Responder a comentarios** constructivamente
- **Hacer cambios solicitados** en commits adicionales
- **No hacer force push** después de crear el PR
- **Una vez aprobado**, el mantenedor hará merge

## 🐛 Reportar Bugs

### Antes de Reportar

1. **Buscar en issues existentes** para evitar duplicados
2. **Verificar** que es realmente un bug
3. **Probar en último commit** de develop
4. **Reunir información** detallada

### Template de Bug Report

```markdown
---
name: Bug Report
about: Reportar un error en el sistema
title: '[BUG] Descripción corta del problema'
labels: bug
---

## 🐛 Descripción del Bug

Descripción clara y concisa del problema.

## 🔄 Pasos para Reproducir

1. Ve a '...'
2. Haz click en '...'
3. Desplázate hasta '...'
4. Ver error

## ✅ Comportamiento Esperado

Descripción clara de lo que esperabas que pasara.

## 📱 Información del Sistema

- **Navegador**: [Chrome 120, Firefox 119, Safari 17]
- **Dispositivo**: [Desktop, iPhone 12, Samsung Galaxy]
- **Sistema Operativo**: [Windows 11, macOS 14, Android 13]
- **Resolución de pantalla**: [1920x1080, 390x844]

## 📸 Screenshots

Si es posible, agregar capturas de pantalla del problema.

## 📋 Información Adicional

- ¿El problema ocurre siempre o a veces?
- ¿Has notado algún patrón?
- ¿Hay mensajes de error en la consola?

## 🔍 Logs de Consola

```
// Pegar logs de la consola del navegador aquí
```

## 🔧 Intentos de Solución

¿Has intentado alguna solución? ¿Cuál fue el resultado?
```

## ✨ Solicitar Funcionalidades

### Template de Feature Request

```markdown
---
name: Feature Request
about: Sugerir una nueva funcionalidad
title: '[FEATURE] Descripción de la funcionalidad'
labels: enhancement
---

## 🎯 Problema que Resuelve

Descripción clara del problema que esta funcionalidad resolvería.

## 💡 Solución Propuesta

Descripción clara de lo que quieres que ocurra.

## 🔄 Alternativas Consideradas

Descripción de cualquier solución alternativa que hayas considerado.

## 📊 Impacto en Usuarios

- **¿Quién se beneficiaría?** [Clientes, Admins, Ambos]
- **¿Qué tan frecuente sería el uso?** [Diario, Semanal, Mensual]
- **¿Es crítico o nice-to-have?** [Crítico, Importante, Nice-to-have]

## 🎨 Mockups o Referencias

Si tienes ideas visuales, compártelas aquí.

## 🔧 Consideraciones Técnicas

¿Hay algo técnico específico que debería considerarse?
```

## 📚 Documentación

### Actualizar Documentación

Cuando hagas cambios que requieran documentación:

```bash
# Archivos que pueden necesitar actualización
docs/API.md              # Si cambias endpoints
docs/DATABASE.md         # Si cambias esquema de BD
docs/TROUBLESHOOTING.md  # Si resuelves problemas comunes
README.md               # Si cambias instalación o uso básico
CHANGELOG.md            # Siempre actualizar
```

### Escribir Buena Documentación

```markdown
# ✅ CORRECTO - Específico y con ejemplos

## Endpoint: Crear Reserva

### Descripción
Crea una nueva reserva para un cliente específico.

### URL
`POST /api/bookings`

### Parámetros
```json
{
  "client_id": "uuid",
  "service_id": "number",
  "date_time": "2025-01-15T10:00:00Z",
  "dog_id": "number"
}
```

### Ejemplo de Respuesta
```json
{
  "success": true,
  "booking": {
    "id": 123,
    "status": "confirmed"
  }
}
```

# ❌ INCORRECTO - Vago y sin ejemplos

## Crear Reserva
Endpoint para reservas.
```

## 🏷️ Labels y Organización

### Labels de Issues

```
🔴 Prioridad
priority-critical    # Bloquea funcionalidad principal
priority-high       # Importante resolver pronto  
priority-medium     # Importante pero no urgente
priority-low        # Nice-to-have

🟢 Tipo
bug                 # Error en el código
enhancement         # Nueva funcionalidad
improvement         # Mejora de funcionalidad existente
documentation       # Actualización de docs
question            # Pregunta o consulta

🔵 Área
area-auth          # Sistema de autenticación
area-booking       # Sistema de reservas
area-admin         # Panel administrativo
area-client        # Dashboard cliente
area-ui            # Interfaz de usuario
area-api           # Backend/API
area-pwa           # Progressive Web App
area-email         # Sistema de emails

🟡 Estado
status-ready       # Listo para trabajar
status-in-progress # En desarrollo
status-blocked     # Bloqueado por dependencia
status-review      # En revisión

🟣 Dificultad
difficulty-beginner # Bueno para principiantes
difficulty-medium   # Requiere conocimiento intermedio
difficulty-expert   # Requiere conocimiento avanzado
```

## 🧪 Testing

### Ejecutar Tests

```bash
# Cuando estén implementados
npm test                # Ejecutar todos los tests
npm run test:watch      # Ejecutar en modo watch
npm run test:coverage   # Generar reporte de cobertura
```

### Escribir Tests

```javascript
// Ejemplo de test para utilidad
import { timeToMinutes, minutesToTime } from '../utils/bookingUtils'

describe('bookingUtils', () => {
  describe('timeToMinutes', () => {
    it('should convert time string to minutes', () => {
      expect(timeToMinutes('10:30')).toBe(630)
      expect(timeToMinutes('00:00')).toBe(0)
      expect(timeToMinutes('23:59')).toBe(1439)
    })
  })
})
```

## 🚀 Release Process

### Preparar Release

```bash
# 1. Asegurar que develop está estable
git checkout develop
git pull upstream develop

# 2. Crear branch de release
git checkout -b release/v1.1.0

# 3. Actualizar versión en package.json
npm version minor  # o patch, major

# 4. Actualizar CHANGELOG.md
# Documentar todos los cambios

# 5. Commit de release
git add .
git commit -m "chore: bump version to 1.1.0"

# 6. Push y crear PR a main
git push origin release/v1.1.0
```

## 📞 Contacto y Ayuda

### Canales de Comunicación

- **Issues de GitHub**: Para bugs y features
- **Discussions**: Para preguntas generales
- **Email**: dev@fisioterapiagossos.com

### Obtener Ayuda

1. **Revisa la documentación** primero
2. **Busca en issues cerrados** por problemas similares
3. **Pregunta en Discussions** para dudas generales
4. **Crea un issue** para bugs específicos

### Horarios de Respuesta

- **Issues críticos**: 24-48 horas
- **Issues normales**: 3-7 días
- **Feature requests**: Revisión mensual
- **Preguntas generales**: 1-3 días

## 🎉 Reconocimiento

### Contribuidores

Todas las contribuciones son reconocidas en:
- **CHANGELOG.md** - Por cada release
- **README.md** - Sección de reconocimientos
- **GitHub Contributors** - Automático

### Tipos de Reconocimiento

- **First-time contributor** - Tu primera contribución
- **Bug hunter** - Encontrar y reportar bugs
- **Feature champion** - Implementar funcionalidades importantes
- **Documentation hero** - Mejorar significativamente la documentación
- **Code reviewer** - Ayudar con revisiones de código

---

## 📄 Resumen

¡Gracias por tomarte el tiempo de leer esta guía! Recuerda:

- **Lee y sigue** las convenciones establecidas
- **Comunícate** antes de hacer cambios grandes
- **Sé paciente** con el proceso de revisión
- **Ayuda a otros** contribuidores cuando puedas
- **Diviértete** contribuyendo al proyecto

¿Tienes preguntas sobre esta guía? ¡Crea un issue y etiquétalo como `question`!

**¡Esperamos tus contribuciones! 🚀**