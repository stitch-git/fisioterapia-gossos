# Changelog

Todos los cambios importantes de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planeado
- Notificaciones push web
- Integración con sistema de pagos
- Recordatorios automáticos por email
- Temas claro/oscuro
- API pública para terceros

## [1.0.0] - 2025-01-XX

### ✨ Añadido
- **Sistema completo de reservas** con motor de compatibilidad avanzado
- **Progressive Web App (PWA)** instalable en dispositivos móviles y escritorio
- **Panel de administración** completo para gestión de citas y configuración
- **Dashboard de cliente** con gestión de reservas y perros
- **Sistema de autenticación** con roles (cliente, admin, super)
- **Gestión de servicios** con reglas de compatibilidad específicas:
  - Rehabilitación (30min, €45)
  - Hidroterapia (30min, €50) 
  - Hidroterapia + Rehabilitación (60min, €85)
  - Aqua Agility (30min, €40)
  - Rehabilitación a Domicilio (variable, €80/hora)
- **Motor de disponibilidad** con validación en tiempo real
- **Notificaciones por email** automáticas para confirmaciones y cancelaciones
- **Gestión de visitas a domicilio** con bloqueo automático del centro
- **Calendario de ocupación** estilo Google Calendar para administradores
- **Configuración de horarios** flexible por fecha específica
- **Sistema de cancelaciones** con recargo por cancelación tardía (<24h)
- **Responsive design** optimizado para móviles, tablets y escritorio
- **Cache inteligente** para mejorar rendimiento
- **Validación atómica** para prevenir reservas duplicadas
- **Gestión completa de perros** por cliente
- **Reportes de ocupación** y métricas de uso
- **Deploy automatizado** con Docker y nginx
- **Documentación completa** con guías de instalación, API, y troubleshooting

### 🔧 Técnico
- **React 18.2** con hooks y context API
- **Vite 5.0** como bundler y herramientas de desarrollo
- **Supabase** como backend (PostgreSQL + Auth + Edge Functions)
- **Tailwind CSS** para estilos responsive
- **React Router 6** para navegación SPA
- **React Hot Toast** para notificaciones
- **Date-fns** para manejo de fechas
- **Vite PWA Plugin** para funcionalidad PWA
- **Row Level Security (RLS)** en base de datos
- **Resend** para envío de emails
- **Docker multi-stage** para deploy optimizado
- **nginx** con configuración SPA optimizada

### 🎨 Características de UI/UX
- **Iconos intuitivos** para cada tipo de servicio
- **Estados visuales** claros para disponibilidad de horarios
- **Feedback inmediato** en todas las interacciones
- **Loading states** consistentes
- **Error handling** robusto con mensajes específicos
- **Navegación adaptativa** según el rol del usuario
- **Calendario visual** con códigos de color para disponibilidad
- **Formularios optimizados** con validación en tiempo real
- **Modal responsive** para todas las pantallas
- **Shortcuts PWA** para acciones rápidas

### 🔒 Seguridad
- **Autenticación segura** con Supabase Auth
- **Validación en cliente y servidor** para todos los formularios
- **RLS policies** para acceso granular a datos
- **Sanitización de inputs** para prevenir inyecciones
- **Headers de seguridad** configurados en nginx
- **Variables de entorno** protegidas
- **Sesiones seguras** con renovación automática

### 📱 PWA Features
- **Instalación nativa** en dispositivos
- **Iconos adaptativos** para todas las plataformas
- **Splash screens** personalizadas
- **Shortcuts de aplicación** para acciones comunes
- **Manifest completo** con metadatos
- **Service Worker** con cache inteligente
- **Funcionamiento offline** básico
- **Actualizaciones automáticas** con notificación

### 🚀 Rendimiento
- **Code splitting** automático por rutas
- **Lazy loading** de componentes pesados
- **Imágenes optimizadas** con formatos modernos
- **Cache HTTP** configurado para assets estáticos
- **Consultas optimizadas** con índices de base de datos
- **Bundle size** optimizado (~400KB gzipped)
- **First Contentful Paint** < 1.5s
- **Time to Interactive** < 3s

### 📧 Sistema de Notificaciones
- **Email de bienvenida** al registrarse
- **Confirmación de reserva** automática
- **Notificación de cancelación** para clientes y admin
- **Recordatorio 24h antes** de la cita (planeado)
- **Templates responsive** para emails
- **Personalización** con datos del cliente y mascota
- **Manejo de errores** robusto en envío

### 🏠 Visitas a Domicilio
- **Programación flexible** de horarios
- **Cálculo automático** de duración y precio
- **Bloqueo inteligente** del centro durante visitas
- **Gestión de direcciones** del cliente
- **Validación de disponibilidad** específica
- **Integración completa** con el sistema de reservas

### 🛠️ Herramientas de Desarrollo
- **ESLint** configurado para React
- **Deploy script** automatizado
- **Environment handling** robusto
- **Error boundaries** para manejo de errores
- **Debug utilities** para desarrollo
- **Git hooks** para validación pre-commit (planeado)

### 📊 Analytics y Métricas
- **Reportes de ocupación** semanales y mensuales
- **Métricas de servicios** más populares
- **Estadísticas de cancelaciones** y patrones
- **Dashboard de ingresos** estimados
- **Análisis de disponibilidad** por espacio

## [0.9.0] - 2025-01-XX (Beta)

### ✨ Añadido
- Sistema básico de reservas
- Autenticación con Supabase
- Panel administrativo inicial
- Gestión básica de clientes

### 🐛 Corregido
- Problemas de timezone en fechas
- Validación de formularios mejorada
- Manejo de errores en API

## [0.8.0] - 2024-12-XX (Alpha)

### ✨ Añadido
- Configuración inicial del proyecto
- Estructura básica de componentes
- Integración con Supabase
- Sistema de autenticación básico

### 🔧 Técnico
- Configuración de Vite
- Setup de Tailwind CSS
- Estructura de carpetas
- Variables de entorno

## [0.1.0] - 2024-11-XX (Prototipo)

### ✨ Añadido
- Concepto inicial del proyecto
- Investigación de tecnologías
- Diseño de base de datos
- Prototipo de interfaz

---

## Tipos de Cambios

- **✨ Añadido** para nuevas funcionalidades
- **🔄 Cambiado** para cambios en funcionalidades existentes
- **🗑️ Deprecado** para funcionalidades que se eliminarán pronto
- **❌ Eliminado** para funcionalidades eliminadas
- **🐛 Corregido** para corrección de bugs
- **🔒 Seguridad** para vulnerabilidades corregidas
- **🔧 Técnico** para cambios técnicos internos
- **🎨 UI/UX** para mejoras de interfaz y experiencia
- **📱 PWA** para funcionalidades de Progressive Web App
- **🚀 Rendimiento** para mejoras de rendimiento
- **📧 Notificaciones** para sistema de emails
- **🏠 Domicilio** para visitas a domicilio
- **📊 Analytics** para métricas y reportes

## Notas de Versiones

### Semantic Versioning

Este proyecto sigue [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Cambios incompatibles de API
- **MINOR** (0.X.0): Nuevas funcionalidades compatible con versiones anteriores
- **PATCH** (0.0.X): Correcciones de bugs compatibles

### Política de Soporte

- **Versión actual (1.x.x)**: Soporte completo y actualizaciones activas
- **Versiones anteriores (0.x.x)**: Soporte limitado solo para bugs críticos de seguridad

### Breaking Changes

Los cambios que rompen compatibilidad se documentarán claramente con:
- ⚠️ **BREAKING CHANGE** en el título
- Instrucciones de migración detalladas
- Fecha de deprecación de la funcionalidad anterior

### Contribuciones

Para contribuir al changelog:
1. Lee la [Guía de Contribución](CONTRIBUTING.md)
2. Usa las convenciones de [Conventional Commits](https://conventionalcommits.org/)
3. Actualiza este archivo en tu Pull Request
4. Categoriza tus cambios correctamente

### Links y Referencias

- [Repositorio en GitHub](https://github.com/tu-usuario/fisioterapia-gossos)
- [Documentación Completa](docs/)
- [Guía de Instalación](docs/SETUP.md)
- [Reportar Bugs](https://github.com/tu-usuario/fisioterapia-gossos/issues/new?template=bug_report.md)
- [Solicitar Features](https://github.com/tu-usuario/fisioterapia-gossos/issues/new?template=feature_request.md)

---

**Mantenido por**: Equipo de Desarrollo Fisioterapia Gossos  
**Última actualización**: 2025-01-XX  
**Formato**: [Keep a Changelog v1.0.0](https://keepachangelog.com/es-ES/1.0.0/)