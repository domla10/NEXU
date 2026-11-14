# NEXU

**NEXU** es una plataforma digital de apoyo a la gestión académica, planteada inicialmente como una **aplicación web progresiva (PWA)** para la Universidad Nacional Experimental Simón Rodríguez (UNESR), Venezuela.

> **Estado:** planificación y preparación de un prototipo. El repositorio contiene únicamente la estructura inicial y documentación, no una aplicación funcional.

## Propósito

Digitalizar y agilizar el registro de asistencia en clases y, en una fase posterior, facilitar la consulta y revisión oportuna de calificaciones. NEXU es un sistema **auxiliar e independiente**: **no reemplaza los sistemas oficiales de la universidad ni modifica calificaciones oficiales**.

## Prioridad actual: piloto de asistencia

La propuesta institucional de noviembre de 2026 concentra la primera prueba piloto en **una unidad curricular y una sección**, con un docente colaborador y autorización institucional. Su alcance comprende:

- **QR dinámico**: el profesor abre una sesión y muestra códigos de vigencia corta con renovación continua (30 segundos es una propuesta inicial, no una decisión final). La validación debe ocurrir de manera segura desde un servicio o mecanismo confiable. El código QR no contiene datos personales.
- **Registro manual de respaldo**: el profesor puede registrar asistencias en caso de fallos de conexión, batería o disponibilidad del dispositivo del estudiante. Se conserva trazabilidad del registro.
- **Listado de estudiantes por sección**: cada asistencia debe quedar asociada a la matrícula autorizada de una sección; escanear un QR no implica inscribirse automáticamente.
- **Reportes descargables**: exportación a PDF, Excel y DOCX con respaldos según el procedimiento acordado con la institución.
- **Privacidad y seguridad**: únicamente datos mínimos autorizados; control de acceso por rol y sección, historial de cambios y protección de información personal.

El QR rotativo **no elimina por completo** el fraude: deben validarse medidas complementarias durante el piloto. La asistencia QR totalmente offline tampoco está resuelta y **no debe prometerse**.

## Futuro módulo de calificaciones (fuera del alcance del piloto inicial)

- Unidades y evaluaciones configurables, con distintos pesos y puntos obtenidos.
- Registro privado de calificaciones por el docente.
- **Publicación simultánea** a la sección por evaluación o unidad, después de su revisión.
- Vista personal para el estudiante, acumulados y solicitudes de revisión.
- Historial de correcciones con autor, fecha y valores anterior y nuevo.
- Aclaración visible de que las notas son informativas y no sustituyen las oficiales.

## Perfiles de usuario

- **Docente:** gestiona secciones autorizadas, asistencia, reportes y, posteriormente, calificaciones.
- **Estudiante:** registra asistencia y consulta exclusivamente sus datos autorizados.
- **Administrador:** administra usuarios, permisos y organización académica dentro del alcance aprobado.

## Estructura del repositorio

```text
NEXU/
├── apps/web/                # PWA: interfaz y módulos por función
│   ├── src/app/             # Vistas y rutas (si se adopta Next.js)
│   ├── src/components/      # Componentes comunes de interfaz
│   ├── src/features/        # Asistencia, notas, autenticación y estructura académica
│   ├── src/lib/             # Utilidades e integraciones
│   ├── src/styles/          # Estilos
│   └── public/              # Recursos estáticos
├── services/api/            # API / validación de sesiones y controles de acceso
├── services/worker/         # Trabajos y exportaciones en segundo plano si hacen falta
├── packages/shared/         # Tipos y reglas compartidas
├── packages/ui/             # Componentes reutilizables
├── database/                # Migraciones, políticas de acceso y datos de prueba
├── docs/                    # Arquitectura, producto, seguridad y piloto institucional
├── tests/                   # Pruebas unitarias, de integración y extremo a extremo
├── scripts/                 # Utilidades de desarrollo
└── .github/workflows/       # Automatizaciones futuras de CI
```

Las carpetas están reservadas para el desarrollo. La separación `services/` no supone que deba desplegarse un servidor específico ni una arquitectura compleja desde el inicio.

## Tecnología por decidir

Se han estudiado **Next.js**, **Supabase/PostgreSQL**, **Cloudflare Pages** o **Vercel**, así como alternativas de almacenamiento local y respaldo. **Ninguna combinación se considera aprobada o implementada todavía.** La conectividad entre el teléfono del alumno y el registro del docente, la estrategia offline, el alojamiento, la política de backups y las condiciones de los planes gratuitos siguen por validar.

## Principios de diseño

1. Priorizar el funcionamiento sencillo en teléfonos y navegadores, con instalación opcional como PWA.
2. Mantener el piloto enfocado en asistencia, sin integrar sistemas administrativos oficiales.
3. Aplicar autorización por rol, institución y sección; no almacenar credenciales o datos reales de estudiantes en Git.
4. Registrar cambios sensibles y mantener posibilidades de respaldo y recuperación.
5. No prometer seguridad antifraude absoluta ni funcionamiento offline completo antes de comprobarlos.
6. Adaptar el sistema a las autorizaciones institucionales y la normativa de protección de datos aplicable.

## Ruta inicial

1. Obtener autorización para el piloto y designar materia, sección y docente colaborador.
2. Definir flujos, modelo de datos, permisos y mecanismo de validación QR.
3. Desarrollar el módulo de asistencia y el registro manual.
4. Preparar exportaciones PDF/Excel/DOCX y respaldos.
5. Probar en aula, registrar fallos y evaluar ahorro de tiempo y facilidad de uso.
6. Considerar calificaciones en una fase posterior.

## Acceso y propiedad

**Repositorio privado previsto.** No se incluye licencia open source. Los términos de propiedad intelectual, colaboración y eventual licencia gratuita de uso para la UNESR deben formalizarse por separado. Mantener un repositorio privado no concede ni garantiza por sí solo derechos exclusivos.

## Documentación

Consulta `docs/` para decisiones, alcance del piloto, riesgos y criterios de seguridad. La estructura está lista para incorporar código sin prejuzgar todas las tecnologías.
