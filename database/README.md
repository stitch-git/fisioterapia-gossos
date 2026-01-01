# Database Documentation

Esta carpeta contiene la documentación completa del esquema de base de datos del proyecto Fisioterapia Gossos.

## Archivos

- **`schema_detailed.md`**: Documentación completa del esquema de base de datos
  - Tablas con todos sus campos
  - Funciones RPC (incluido `create_booking_atomic`)
  - Políticas RLS
  - Triggers
  - Relaciones entre tablas
  - Notas importantes sobre estados, tipos, etc.

## Uso

Consulta `schema_detailed.md` cuando necesites:
- Entender la estructura de una tabla
- Ver qué parámetros acepta una función RPC
- Conocer las políticas de seguridad (RLS)
- Entender las relaciones entre tablas

## Actualización

Este documento debe actualizarse cada vez que:
- Se añade/modifica una tabla
- Se crea/modifica una función RPC
- Se cambian políticas RLS
- Se añaden triggers o índices importantes

**Última actualización:** 2026-01-01