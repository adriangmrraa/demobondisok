# Grill Me Results

Generated: 2026-09-14T23:32:58.225Z

## Plan

sobre el estilo visual de esta maqueta

## Shared Understanding

Especificación de la nueva Pantalla Principal Mobile (Home) para pre-mvp-transportes acordada y documentada en docs/PANTALLA-HOME-MOBILE-ESPECIFICACION.md.

## Questions and Answers

### 1. ¿Cómo debemos estructurar las rutas en Next.js para la convivencia entre el nuevo Home y el Mapa?

**Recommended answer:** Opción 1: Separación de rutas / (Home) y /mapa (Mapa)

**User answer:** Opción 2: Single Page Application (SPA) con Tabs en la raíz /. El Home está en el root por defecto, y el mapa aparece al presionar el icono de mapa en la nav bar inferior.

**Status:** resolved

**Notes:** El usuario eligió mantener la experiencia en la raíz `/` usando arquitectura SPA/Tabs. El Home se muestra por defecto y el mapa se activa como segunda pantalla al tocar el ícono de mapa en la navbar inferior.

### 2. ¿Cómo debe comportarse la lógica del saludo dinámico y qué acción debe desencadenar el botón de notificaciones?

**Recommended answer:** Opción 1: Saludo dinámico por horario + Drawer/Panel deslizante de Notificaciones

**User answer:** Opción 1: Saludo dinámico por horario local, fecha en formato legible en español y panel flotante o Drawer de notificaciones con badge indicador de alertas.

**Status:** resolved

**Notes:** El header incluirá un saludo dinámico por horario local (Buenos días/tardes/noches) con fecha formateada en español, e ícono de notificaciones con dot indicador que despliega un panel flotante/drawer con las alertas del servicio.

### 3. ¿Qué disposición exacta y qué funcionalidad debe tener el botón central de la Rosa y la Navbar inferior?

**Recommended answer:** Opción 1: Dock Flotante estilo Stadium Pill + Rosa como Botón Destacado de Acción Rápida

**User answer:** Orden exacto de izquierda a derecha: 1) Líneas, 2) Tus Paradas, 3) Rosa (Centro - Funcionalidad: Redirecciona a la pantalla del Mapa), 4) Perfil, 5) Inicio.

**Status:** resolved

**Notes:** Orden definitivo de la Bottom Navbar (izq a der): 1. Líneas | 2. Tus Paradas | 3. Rosa (Centro - Acción: Mapa) | 4. Perfil | 5. Inicio. La Rosa actúa como el disparador central hacia la pantalla interactiva del mapa.

### 4. ¿Cómo debemos estructurar la arquitectura del contenedor de tarjetas en el código y en qué formato entregaremos la Documentación Técnica para la revisión del equipo?

**Recommended answer:** Opción 1: Feed Modular Extensible + Documento Técnico Completo

**User answer:** Implementar la opción 1. Cada tarjeta debe ser independiente con un esquema de modularización. Excluir el punto 4 (tokens de diseño) por ahora. Crear el documento técnico en formato MD.

**Status:** resolved

**Notes:** Acordado: Contenedor HomeCardFeed modular por slots con componentes de tarjetas 100% independientes. Excluido el punto 4 (tokens de diseño) para una etapa posterior. Documentación técnica a entregar en formato Markdown (.md).

## Agreed Decisions

- Architecture: SPA basada en tabs de estado en la raíz / (Home por defecto, Mapa activado por la Rosa central).
- Header Superior: Saludo dinámico por franja horaria local (Buenos días/tardes/noches), fecha formateada en español rioplatense y panel deslizante (Drawer) para notificaciones con badge indicador.
- Bottom Navigation Bar: Orden estricto (izq a der): 1. Líneas | 2. Tus Paradas | 3. Rosa (Centro - Redirecciona al Mapa) | 4. Perfil | 5. Inicio.
- Zona Central & Doc Técnico: Contenedor HomeCardFeed modular por slots con tarjetas 100% independientes. Excluido el punto 4 (tokens de diseño). Especificación guardada en docs/PANTALLA-HOME-MOBILE-ESPECIFICACION.md.

## Open Risks

- Definición de las tarjetas específicas que compondrán la zona central del Home (se recibirán progresivamente).

## Next Decision Needed

Esperar la revisión y el OK del equipo de programadores sobre el documento técnico antes de iniciar la maquetación.
