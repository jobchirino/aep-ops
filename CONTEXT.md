# CONTEXT.md - Sistema Operativo AEP Medicare (EduFuture / Equipo AEP)

## 1. Reglas Estrictas de Stack y Código
- **PROHIBIDO USAR TYPESCRIPT:** Todo el código debe ser JavaScript puro (`.js`, `.jsx`, `.mjs`). No crear archivos `.ts` ni `.tsx`.
- **Framework:** Next.js (App Router) en directorio `src/app`.
- **Base de Datos:** PostgreSQL (Neon.tech) con Prisma ORM (`prisma/schema.prisma`).
- **Estilos:** Tailwind CSS + componentes limpios con `lucide-react`.
- **Mutaciones:** Usar Server Actions de Next.js (`"use server"`) con `revalidatePath`.
- **Autenticación y Firma Automática:** Basada en cookies JWT (`jose`). TODA acción (crear nota en línea de tiempo, cambiar estado, reclamar cliente, guardar 21/13 puntos, actualizar documentos) DEBE obtener el usuario en sesión mediante `await getCurrentUser()` en el servidor y atribuir el registro a ese `user.id` automáticamente, sin pedirle al usuario que escriba su nombre.

## 2. Usuarios del Equipo (Cuentas Preconfiguradas)
1. **Job** (`job@edufuture.org` - Rol: `AGENT`, código: `JOB`)
2. **Maria** (`maria@edufuture.org` - Rol: `AGENT`, código: `MARIA`)
3. **Gabriela** (`gabriela@edufuture.org` - Rol: `AGENT`, código: `GABY`)
4. **Fernando** (`fernando@edufuture.org` - Rol: `AGENT`, código: `FER`)

> No existe el rol `BOSS`. Todos los usuarios son agentes.
> Tatiana **no es usuaria del sistema**: recibe las aplicaciones por un chat externo.

## 3. Flujo Operativo del Caso (Pipeline AEP)
Cada cliente de AEP proviene de una de 4 categorías: `NO_RENOVABLE`, `NO_COMISIONABLE`, `CANCELADO` o `ENTRANTE`. Los casos `ENTRANTE` son clientes que ya existen en Radius y llaman por su cuenta para un cambio de plan; se agregan desde el buscador de clientes del dashboard. Y pasa por estas etapas (`stage`):
1. `SIN_CONTACTAR`: Pendiente de primera llamada.
2. `EN_SEGUIMIENTO`: No contestó (NC), se dejó SMS/Voicemail, o pidió que lo llamen en otra fecha (`nextFollowUpAt`).
3. `PUNTOS_COMPLETOS`: Ya se levantaron los 21 puntos en llamada y se generaron los 13 puntos.
4. `BUSCANDO_PLAN`: Evaluando plan comisionable 2027 (Estrategia).
5. `ESPERANDO_FIRMA`: Plan elegido, esperando firma de SOA / Enrollment del cliente.
6. `CERRADO_DOCS_ENVIADOS`: Documentos completos, checklist validado y fechas calculadas. El agente envía la aplicación a Tatiana por chat. **Etapa final exitosa.**
7. `DESCARTADO`: Se cambió con otro agente, no desea renovar o número inválido definitivo.

> No existen estados legacy: cualquier caso importado que ya estaba enviado/aplicado se migra a `CERRADO_DOCS_ENVIADOS`.

## 4. Bloqueo en Tiempo Real ("En Llamada")
- Cuando un agente abre un caso y pulsa **"📞 Marcar En Llamada"**, el campo `lockedByUserId` se asigna a ese agente y `lockedAt` guarda la hora.
- En la lista general, los demás agentes ven un indicador rojo/ámbar: `"📞 Job está trabajando este caso ahora"` para evitar llamadas duplicadas.

### 4.1 Asignación de casos
- Cualquier agente puede cambiar el agente asignado desde la cabecera del detalle o desde el select de la columna "Agente" del dashboard.
- Cada cambio registra un `TimelineEvent` de tipo `ASSIGNMENT` firmado por el usuario en sesión.
- El cliente debe existir previamente en Radius; un cliente solo puede tener un caso AEP. Si ya tiene uno, se abre el existente.

## 5. Reglas de Negocio Críticas
### A. De 21 Puntos a 13 Puntos
- El formulario de **21 Puntos** guarda las respuestas de la llamada en JSON.
- Los **13 Puntos** se prellenan combinando:
  1. Datos extraídos de Radius (`fullName`, `gender`, `dob`, `phone`, `address`, `city`, `state`, `zip`, `county`, `mbi`, `partADate`, `partBDate`, `ssn`, `medicaidNumber`, `currentPlanName`).
  2. Datos capturados en los 21 puntos (`pcp`, `pensiones / trabajo anterior`, `401k / 403b`).
  3. Datos de cierre (`targetPlanName` como `ESTRATEGIA`, `targetEffDate` por defecto `01/01/2027`).
- Debe existir un botón **"Copiar Bloque de 13 Puntos"** que copie el formato exacto de texto requerido por la empresa.

### B. Validador de Planes No Comisionables
- Antes de confirmar el campo `ESTRATEGIA` (Plan Nuevo), el agente puede buscar por `Plan ID` (ej. `H5521-419`) o nombre y Estado en la tabla `NonCommissionablePlan`.
- Si el plan aparece en la lista de no comisionables para ese Estado/Año, mostrar alerta roja: `"⚠️ CUIDADO: Este plan figura como NO COMISIONABLE"`.

### C. Checklist Dinámico de Documentos por Aseguradora
- Si `targetCarrier` es **Clover** (case-insensitive), se requieren **4 documentos obligatorios**:
  1. `SOA`
  2. `Enrollment`
  3. `Attestation`
  4. `Statement of Understanding`
- Para **cualquier otra aseguradora** (Anthem, UHC, Humana, Aetna, Wellcare, etc.), se requieren **2 documentos obligatorios**:
  1. `SOA`
  2. `Enrollment`
- Solo cuando todos los documentos requeridos estén marcados en `true`, se habilita el botón **"✅ Marcar Docs Listos y Cerrar Caso"**.
- El cierre es definitivo: cambia `stage` a `CERRADO_DOCS_ENVIADOS`, guarda `docsChecklist`, `docsReady`, `soaDate`, `enrollmentDate`, `targetCarrier`, `targetPlanName` y `sentAt`, registra el evento `DOCS_READY` firmado por el agente y redirige al dashboard.

### D. Calculadora Automática de Fechas para Documentos
1. **Regla de las 48 horas:** La `soaDate` SIEMPRE debe ser **2 días antes (48 horas)** de la `enrollmentDate`.
2. **Regla de Compañía y Estado:**
   - Clientes con la **misma compañía (`targetCarrier`) y el mismo estado (`state`)** PUEDEN tener la misma `enrollmentDate`.
   - Clientes con la **misma compañía (`targetCarrier`) pero en DIFERENTE estado (`state`)** DEBEN tener una `enrollmentDate` de **un día después (+1 día)** respecto al último cliente registrado de esa misma compañía en otro estado.

> Al cerrar el caso, el evento firmado dice: `"Documentos completados y enviados a Tatiana por chat"`. Tatiana recibe el paquete por chat externo; el sistema no tiene bandeja de salida ni usuario Tatiana.

### E. Generador Automático de Nota para Radius
- Cada evento registrado en la línea de tiempo genera un string listo para Radius con formato:
  `MM/DD/YYYY [NOMBRE_AGENTE]: Detalle del avance` (más link directo `radiusUrl` para abrir el perfil del cliente en RadiusBob en otra pestaña y pegar la nota en 2 segundos).