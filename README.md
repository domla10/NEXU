# NEXU

**NEXU** es una plataforma digital de apoyo a la gestión académica, planteada inicialmente como una **aplicación web progresiva (PWA)** para la Universidad Nacional Experimental Simón Rodríguez (UNESR), Venezuela.

> **Estado:** prototipo visual 0.1.1 con pantallas de demostración y datos ficticios; aún no registra asistencias ni cuenta con autenticación.

## Propósito

Digitalizar y agilizar el registro de asistencia en clases. NEXU es un sistema **auxiliar e independiente** y no reemplaza los sistemas oficiales de la universidad.

## Prioridad actual: piloto de asistencia

El curso propuesto provisionalmente para el piloto es **Química Orgánica**, del programa de Ingeniería de Alimentos de la **UNESR, Núcleo Araure**. Todavía no existe autorización institucional para realizar pruebas con datos reales. La propuesta requiere un facilitador colaborador y aprobación institucional. Su alcance previsto comprende:

- **QR dinámico**: el profesor abre una sesión y muestra códigos de vigencia corta con renovación continua (30 segundos es una propuesta inicial, no una decisión final). La validación debe ocurrir de manera segura desde un servicio o mecanismo confiable. El código QR no contiene datos personales.
- **Registro manual de respaldo**: el profesor puede registrar asistencias en caso de fallos de conexión, batería o disponibilidad del dispositivo del estudiante. Se conserva trazabilidad del registro.
- **Listado de participantes por curso**: cada asistencia deberá quedar asociada a una matrícula autorizada; escanear un QR no implica inscribirse automáticamente.
- **Reportes descargables**: exportación a PDF, Excel y DOCX con respaldos según el procedimiento acordado con la institución.
- **Privacidad y seguridad**: únicamente datos mínimos autorizados; control de acceso por rol y sección, historial de cambios y protección de información personal.

El QR rotativo **no elimina por completo** el fraude: deben validarse medidas complementarias durante el piloto. La asistencia QR totalmente offline tampoco está resuelta y **no debe prometerse**.

## Perfiles de usuario

- **Facilitador:** gestiona cursos autorizados, asistencia y reportes.
- **Participante:** registra asistencia y consulta exclusivamente sus datos autorizados.
- **Administrador:** administra usuarios, permisos y organización académica dentro del alcance aprobado.

## Estructura del repositorio

```text
NEXU/
├── apps/web/                # PWA: interfaz y módulos por función
│   ├── src/app/             # Vistas y rutas (si se adopta Next.js)
│   ├── src/components/      # Componentes comunes de interfaz
│   ├── src/features/        # Asistencia, autenticación y estructura académica
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

Se han estudiado **Next.js**, **Supabase/PostgreSQL**, **Cloudflare Pages** o **Vercel**, así como alternativas de almacenamiento local y respaldo. **El prototipo web usa Next.js; las migraciones de Supabase no están conectadas al frontend y solo se han aplicado al proyecto remoto de pruebas NEXU-TEST.** Las demás decisiones siguen pendientes. La conectividad entre el teléfono del alumno y el registro del docente, la estrategia offline, el alojamiento, la política de backups y las condiciones de los planes gratuitos siguen por validar.

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

## Acceso y propiedad

**Repositorio privado previsto.** No se incluye licencia open source. Los términos de propiedad intelectual, colaboración y eventual licencia gratuita de uso para la UNESR deben formalizarse por separado. Mantener un repositorio privado no concede ni garantiza por sí solo derechos exclusivos.

## Documentación

Consulta `docs/` para decisiones, alcance del piloto, riesgos y criterios de seguridad. La estructura está lista para incorporar código sin prejuzgar todas las tecnologías.

## Ejecutar el prototipo web

La versión 0.1.1 ofrece pantallas de demostración con datos ficticios. El curso provisional se configura en `apps/web/src/lib/demo-courses.ts`. No incluye autenticación, registro de asistencia ni QR funcional. No existe autorización institucional para pruebas con datos reales.

Requisitos: Node.js 20.9 o posterior y npm. Desde la raíz del repositorio:

```bash
cd apps/web
npm ci
npm run dev
```

Abre `http://localhost:3000`. Para comprobar la aplicación ejecuta `npm run typecheck`, `npm run lint` y `npm run build`. Para acceder desde un teléfono en la misma red, inicia `npm run dev -- --hostname 0.0.0.0` y abre `http://<IP-local-del-equipo>:3000` en el teléfono; la red y el cortafuegos deben permitir la conexión. En un entorno Cloud remoto se necesita una URL de vista previa o un túnel seguro.

## Frontend de autenticación y paneles

Las rutas `/login`, `/register` y `/forgot-password` muestran formularios de demostración que validan la interfaz: no crean cuentas, no inician sesión y no envían correos. No se deben introducir credenciales reales. Las rutas existentes `/docente` y `/estudiante` muestran paneles públicos con datos ficticios; cambiar de vista no concede permisos. Los roles reales deberán validarse en el servidor cuando exista un backend. El curso de muestra permanece en `apps/web/src/lib/demo-courses.ts`.

El piloto sigue sujeto a autorización institucional antes de usar datos reales.

## Infraestructura de datos propuesta

La migración versionada y las pruebas RLS están en `supabase/`. Consulta [Infraestructura de datos y seguridad](docs/infraestructura-datos.md) para el modelo, las pruebas aisladas y los pasos previos a cualquier aplicación futura. No se ha aplicado al proyecto Supabase principal.

El modelo de autorización por curso y administración independiente se describe en [Modelo multirrol y autorización](docs/modelo-multirrol.md). Las migraciones se han aplicado únicamente a NEXU-TEST; antes de usarlas en otra base hay que revisar su historial.
