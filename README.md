# Grupo GRP · Simulador de Financiación multimarca

Evolución de la POC original, conservando su diseño, HTML semántico, CSS propio y JavaScript vanilla. Permite seleccionar una marca, cotizar con sus campañas, aplicar topes, comparar alternativas de la misma marca e imprimir resultados como PDF. No tiene backend, dependencias de ejecución, compilación ni servicios externos.

**Las condiciones financieras provienen de las circulares comerciales de octubre de 2026. Los precios FIAT heredados son ilustrativos y editables; los demás precios requieren ingreso manual.** No constituye oferta, aprobación crediticia ni cotización vinculante. No es una aplicación aprobada oficialmente por GRP ni por las marcas. Actualización: 15/10/2026.

## Marcas, fuentes y alcance

| Marca | Fuente local verificada | Planes / plazos |
| --- | --- | ---: |
| FIAT | `10-2026-Fiat_Circular_comercial_FCA.pdf` · FCA 016.26 | 5 / 23 |
| Jeep | `10-2026-JeepRam_Circular_comercial_FCA.pdf` · FCA 017.26 | 5 / 18 |
| RAM | Misma circular 017.26, pero catálogo y planes separados de Jeep | 3 / 12 |
| Peugeot | `10-2026-AP_Circular_comercial_PSA PEUGEOT.pdf` · PSA 469.26 | 5 / 28 |
| Citroën | `10-2026-AC_Circular_comercial_PSA CITRO.pdf` · PSA 457.26 | 5 / 28 |
| GM / Chevrolet | Pendiente de recibir su circular | 0 / 0 |
| BYD | Pendiente de recibir su circular; no “BYOD” | 0 / 0 |

Se verificaron visualmente **sólo PROMOCIONES 0 Km de la página 3** y el LTV de riesgos: página 8 en FCA, página 9 en PSA. Todas las campañas seleccionadas son canal **TRAD** y excluyen seguro automotor. Hay 23 planes y 109 alternativas de plazo; la línea ampliada de cada marca PSA se representa con dos planes relacionados para distinguir el máximo general del especial por modelo.

Los PDFs se consultaron desde `/Users/juano/Downloads/GRP/`. **No se copiaron al repositorio**, no se enlazan con `file://` ni se publicaron páginas, fotos o contactos. La aplicación muestra sus nombres y páginas como texto. Quedan fuera usados, ventas especiales, leasing, planes de ahorro, taxi, remis, Rent a Car, documentación y el resto de los requisitos de riesgo.

## Abrir en localhost

No hay que instalar paquetes ni compilar. Se necesita Python 3 y un navegador moderno.

1. Descargá o copiá esta carpeta a tu computadora.
2. Abrí una terminal dentro de la carpeta que contiene `index.html`.
3. Ejecutá:

   ```bash
   python3 -m http.server 8000
   ```

   En Windows, si `python3` no existe, probá `py -m http.server 8000`.
4. Abrí **http://localhost:8000** en el navegador.
5. Para detener el servidor, volvé a la terminal y presioná **Ctrl+C**.

No abras `index.html` con doble clic (`file://`): los módulos ES necesitan un servidor HTTP. Si el puerto está ocupado, elegí otro, por ejemplo `8001`, también en la URL. Para restringir el acceso a la computadora local, agregá `--bind 127.0.0.1` al comando.

## Uso

- **Marcas:** FIAT es la selección inicial. Cambiar de marca actualiza logo, acento, modelos, planes, fuente y pie, sin recargar; limpia los resultados anteriores y anuncia el cambio a lectores de pantalla. La selección se opera con clic, Tab y las flechas nativas de los radios.
- **Cotizador:** conserva precios FIAT ilustrativos. Para modelos sin precio, ingresalo manualmente; al elegir uno se enfoca ese campo. Si no hay versiones cargadas, el selector se deshabilita y la condición se aplica por modelo. Elegí plan/plazo y presioná **Recalcular**. Editar datos oculta resultados desactualizados.
- **Comparador:** usa la marca, vehículo, versión, precio y anticipo del cotizador. Sólo admite planes compatibles de esa marca. No recomienda una opción. No destaca aporte CE, coeficiente, capital ni LTV como ventajas; tampoco califica cuotas, TNA o totales entre líneas UVA y pesos. La diferencia no financiada se muestra por alternativa.
- **Fuentes y vigencia:** conserva las campañas y sus metadatos aun cuando venzan, sin habilitar cotizaciones históricas como si fueran actuales.
- **GM / Chevrolet y BYD:** son seleccionables y muestran “Información comercial pendiente”. No tienen modelos, precios ni tasas de respaldo. Se deshabilitan formulario y comparador, sin recurrir a otra marca.
- **Imprimir / Guardar PDF:** abre el diálogo nativo del navegador. Elegí “Guardar como PDF”. Se imprime el resultado de la sección actual, con marca tipográfica, fechas y advertencias, sin controles. No hace falta habilitar fondos de impresión. En la vista de datos, Ctrl+P imprime la última cotización válida, si existe.
- **Limpiar:** borra la selección guardada, sin cambiar automáticamente de marca. Se recuerda la última marca incluso si está pendiente, y opcionalmente la última cotización válida, bajo `grp-finance-poc:v2`. Los datos `v1` se descartan: sus planes ficticios no se migran a condiciones comerciales. Si el almacenamiento está bloqueado o corrupto, la aplicación sigue funcionando.

## Estructura

```text
.
├── index.html                 # HTML semántico, formulario, pestañas y resultados
├── styles.css                 # Diseño responsive y estilos de impresión
├── js/
│   ├── app.js                 # Interfaz, validación, comparación y persistencia
│   ├── calculator.js          # Motor puro, valida marca/modelo/versión y vigencia
│   └── commercial-data.js     # Marcas, modelos, condiciones y fuentes centralizadas
├── assets/
│   ├── grp-logo.png
│   ├── favicon.png
│   ├── brands/               # Logos locales; BYD utiliza sólo texto
│   ├── fiat-logo.png         # Asset histórico conservado, ya no usado por la UI
│   └── ATTRIBUTION.md         # Fuentes y advertencia sobre derechos de uso
├── tests/
│   └── calculator.test.mjs    # Pruebas sin dependencias externas
├── README.md
├── .gitignore                 # Excluye artefactos locales y metadatos del sistema
└── .nojekyll
```

HTML, CSS propio y JavaScript vanilla con módulos ES. Sin framework, backend, proceso de compilación, dependencias de ejecución, fuentes remotas, claves ni variables de entorno. Todas las rutas del sitio son relativas, compatibles con una subcarpeta de GitHub Pages.

## Datos, modelos y condiciones especiales

La única fuente de información comercial es **`js/commercial-data.js`**; no hay tablas de tasas en `app.js`, HTML o CSS:

- `APP_META`: fecha de actualización, moneda y advertencias comunes.
- `BRANDS`: identidad, `status: 'active' | 'pending'`, logo, circular, archivo, páginas de promociones/LTV y vigencia.
- `MODELS_BY_BRAND`: modelos con `brandId`, `id`, `name`, `versions` y precios opcionales. Un precio `null` o una lista `versions: []` es válido y requiere ingreso manual. No inventar precios oficiales ni versiones.
- `PLANS_BY_BRAND`: planes con `id` único, `brandId`, `entity`, `dataStatus: 'commercial-circular'`, `source`, `currency`, `isUva`, `customerTypes`, `modelIds`, `versionIds` opcional, `channel`, `maxAmount`, `maxLtvPct`, `terms`, vigencia y notas.
- Cada plazo tiene `months`, `tna`, `dealerContributionPct` e `installmentPerThousandWithVat`. TNA y CE son porcentajes numéricos; el coeficiente mantiene la unidad original: `84.33` significa **$84,33 por cada $1.000 financiados**, no un multiplicador directo.
- `DEFAULT_SELECTION` y `DEFAULTS_BY_BRAND` definen las selecciones iniciales, sin duplicar condiciones financieras.

Los planes “toda la gama” toman todos los modelos cargados de su marca. Las campañas específicas enumeran sus modelos: FIAT 28 M sólo Cronos/Pulse/Fastback/Toro, TITANO sólo Titano, Jeep 28 M sólo Renegade/Compass/Commander y RAM 30/40 M sólo Dakota/Rampage. **Compass Sport** requiere `versionIds: ['compass-sport']`; “Otras versiones” es una selección operativa, no una versión oficial inventada.

Peugeot: línea ampliada 45 M sólo Boxer/3008/5008/408, y 36 M para los demás. Citroën: 45 M sólo Jumper y 36 M para los demás. Los pares comparten `campaignGroupId` y los coeficientes, pero tienen listas de modelos disjuntas. No se usan los máximos más altos de la tabla general de riesgos para aumentar un tope promocional.

## Vigencia y actualización mensual

Se usa **la fecha local del dispositivo**, no una fecha fija de demostración:

- Antes de 01/10/2026: **Próxima**, sin cotizar.
- Del 01/10/2026 al 31/10/2026 inclusive: **Vigente**.
- Desde 01/11/2026: **Vencida**, con solicitud de una circular nueva; sólo queda consultable en Fuentes y vigencia.
- Sin circular recibida: **Pendiente**.

**No extender fechas para reactivar campañas.** No hay un parámetro de URL ni un selector de fecha que saltee este control. El motor valida la fecha otra vez al cotizar, comparar o imprimir; la interfaz se actualiza también al volver a la ventana. El reloj local no es una fuente de tiempo confiable para un producto financiero definitivo.

Para cargar una nueva circular, incluidas las futuras de GM y BYD:

1. Recibir el documento de una fuente verificada y confirmar permiso para exponer sus condiciones. Mantener el PDF completo fuera del sitio público.
2. Revisar visualmente tabla, unidades, canal, modelos/versiones, notas de seguro y política de LTV. Registrar número, nombre exacto del archivo, páginas y fechas reales.
3. Actualizar los metadatos y planes **de esa marca** en `commercial-data.js`; no copiar tasas de otra. Completar modelos sin inventar precios.
4. En GM/BYD, mantener los arrays vacíos y `status: 'pending'` hasta contar con datos aprobados. Luego completar los arrays y cambiar a `active`. BYD seguirá con fallback tipográfico salvo autorización de un asset verificado.
5. Revisar las selecciones iniciales y actualizar `APP_META.updatedAt`, el badge `circularLabel` y los textos del período. Ejecutar pruebas y validar ejemplos contra la circular. Mantener fuera de esta iteración los otros productos.
6. Revisar y autorizar los cambios antes de hacer commit/push: el repositorio ya está asociado a un sitio público de GitHub Pages.

## Fórmulas

Sean `P` el precio de lista, `A` el anticipo y `n` la cantidad de meses:

```text
solicitado          = P − A
límite LTV          = P × maxLtvPct / 100
capital elegible    = piso(mínimo(solicitado, límite LTV, maxAmount))
cuota inicial       = redondear(capital elegible / 1.000 × installmentPerThousandWithVat)
diferencia          = solicitado − capital elegible
anticipo necesario  = P − capital elegible
total aritmético    = cuota inicial redondeada × n
```

El capital elegible se redondea **hacia abajo a pesos enteros**, para nunca sobrepasar un tope por redondeo. Los otros resultados monetarios se redondean al peso más cercano. Los campos aceptan pesos enteros, con o sin separadores de miles (`32000000` o `32.000.000`).

Ejemplos: 10 M × 84,33 / 1.000 = **$843.300**; con 56,22 = **$562.200**; con 47,83 = **$478.300**. El coeficiente tiene prioridad incluso con TNA cero; no se usa sistema francés ni capital/plazo como reemplazo. Si falta el coeficiente, el plan no calcula. No se “corrigen” diferencias entre coeficientes de FCA y PSA.

**Aporte CE no es un gasto del cliente.** Se muestra sólo como información interna del concesionario: no modifica la cuota, el capital, el anticipo ni la diferencia sin financiar. Tampoco se agrega un seguro, gasto o impuesto inventado. **CFT no informado en la circular:** no se deriva de la TNA ni se calcula uno propio.

Pesos 0 km: LTV 80%. UVA: LTV 70%. No se agrega una promoción UVA RAM porque no figura en su tabla. Para UVA se muestra: “Cuota inicial de referencia. El capital y las cuotas se ajustan por UVA. La POC no proyecta la evolución futura de la UVA”. Su total sólo multiplica cuotas iniciales y **no es una previsión del costo futuro**. Ningún total incluye anticipo, seguro automotor, impuestos u otros cargos.

## Pruebas y controles

Opcionalmente, con Node.js moderno (22 o posterior recomendado), sin instalar paquetes:

```bash
node --test tests/calculator.test.mjs
```

Las 19 pruebas cubren los tres ejemplos numéricos, independencia de CE, prioridad del coeficiente, CFT ausente, LTV, máximos especiales, versiones, marcas pendientes, aislamiento entre marcas, fechas inclusivas y **10.900 escenarios determinísticos** de invariantes. Usan fechas explícitas: 15/10/2026 activo, 01/11/2026 vencido y 30/09/2026 próximo, sin modificar el reloj de la aplicación.

Casos manuales con **FIAT → Campaña Tasa Fija · Toda la gama · 24 M → 12 meses**, mientras la circular esté vigente:

| Caso | Precio | Anticipo | Resultado esperado |
| --- | ---: | ---: | --- |
| Normal | $20.000.000 | $10.000.000 | Financia $10.000.000; cuota $843.300 |
| Límite LTV | $20.000.000 | $1.000.000 | Financia $16.000.000; faltan $3.000.000 |
| Tope de monto | $60.000.000 | $30.000.000 | Financia $24.000.000; faltan $6.000.000 |
| Anticipo inválido | $32.000.000 | $33.000.000 | Error junto al anticipo; cálculo deshabilitado |

Revisar también las siete marcas, cambio de marca tras cotizar, Compass Sport frente a otra versión, máximos PSA por modelo, UVA y sus advertencias, precios manuales sin versión, persistencia bloqueada/corrupta, teclado, PDF con marca/fuente/fecha correctas, 390/360 px y rutas bajo subcarpeta. Para probar fechas fuera de la actual en navegador, usar un reloj emulado sólo en el entorno de pruebas, nunca extender la vigencia del archivo de datos.

## Límites de la POC

- No hay evaluación crediticia, integración bancaria ni confirmación de disponibilidad comercial. El tipo de cliente es un filtro operativo de la POC: no acredita elegibilidad jurídica/física ante la entidad.
- Sólo se modelan las promociones y LTV indicados. No se implementan RCI, monto mínimo de financiación, requisitos documentales u otras políticas de las circulares.
- No calcula seguros, sellos, impuestos, gastos registrales, evolución UVA ni CFT. Tampoco es un plan de ahorro.
- No hay login ni panel administrativo. No se piden ni almacenan nombres, documentos, teléfonos u otros datos personales.
- No envía datos de cotizaciones a terceros. `localStorage` es sólo una comodidad del navegador, no una base de datos ni un archivo compartido de cotizaciones.
- El reloj del dispositivo determina la vigencia; una solución productiva necesitaría una fuente confiable y controles adicionales.
- `noindex` es una sugerencia para buscadores, **no un control de acceso**. Los archivos publicados son públicos.

## Checklist antes de publicar condiciones comerciales

- [ ] Obtener autorización de GRP y de los titulares para usar nombres, marcas, logos y cualquier otro activo.
- [ ] Obtener catálogo, disponibilidad y precios aprobados, con responsable y fecha de revisión.
- [ ] Obtener autorización expresa del cliente para exponer condiciones comerciales en un repositorio/sitio público.
- [ ] Confirmar con cada entidad la transcripción, coeficientes por mil con IVA, TNA, CE, plazos, modelos, versiones, topes, LTV, canal y vigencia.
- [ ] Solicitar CFT y cargos faltantes sin inventarlos; verificar seguros y elegibilidad no representados.
- [ ] Validar fórmulas, redondeos, gastos, impuestos, seguros y alcance legal con responsables financieros y de cumplimiento.
- [ ] Definir una fuente controlada de datos, revisión, trazabilidad, permisos y un mecanismo confiable de vencimientos.
- [ ] Agregar pruebas de las condiciones contractuales y accesibilidad; definir soporte para navegadores.
- [ ] Revisar textos, avisos legales y condiciones antes de modificar el carácter ilustrativo de la herramienta.
- [ ] Confirmar que no haya información confidencial ni secretos en archivos, historial o almacenamiento del sitio.

## Publicar en GitHub Pages

**La versión de referencia está publicada en `https://jfarribillaga.github.io/poc-grp/`. GitHub Pages publica desde `main` y la carpeta `/ (root)`: un push o una integración a `main` puede actualizar automáticamente el sitio.** Para revisar cambios sin reemplazar el sitio actual, subirlos a una rama de revisión y sólo integrarla a `main` cuando se autorice publicar las condiciones comerciales.

Para desplegar después una versión preparada en otra rama, revisar sus cambios y fusionarla a `main` mediante un pull request. No hace falta cambiar la configuración de Pages ni agregar un proceso de compilación. Para configurar Pages en otro repositorio autorizado:

1. Creá un repositorio nuevo en GitHub.
2. Subí todos los archivos del proyecto a la rama **`main`**, incluyendo `assets/`, `js/` y el archivo oculto `.nojekyll`. `index.html` debe quedar en la raíz, no dentro de otra carpeta. No subas PDFs de prueba ni archivos confidenciales.
3. Abrí **Settings → Pages**.
4. En “Build and deployment”, seleccioná **Deploy from a branch**.
5. Elegí la rama **main** y la carpeta **/ (root)**.
6. Guardá y esperá la URL **`https://USUARIO.github.io/REPOSITORIO/`**. Puede demorar unos minutos.

No se necesita GitHub Actions ni un comando de compilación. Las rutas relativas funcionan directamente bajo `/REPOSITORIO/`.

**GitHub Pages publica el sitio en Internet. Esta POC no debe contener datos internos confidenciales.** Un repositorio privado no garantiza que el sitio de Pages sea privado. Confirmá el permiso para exponer la demo y sus activos antes de habilitar Pages.

El badge “uso interno” y `noindex, nofollow` **no impiden el acceso público**. Para un uso verdaderamente interno, una fase posterior debe usar hosting con autenticación y control de acceso; no agregar un login ficticio a esta SPA.

## Marcas y activos

Se conservaron logo GRP y favicon y se guardaron seis logos de marca publicados por GRP en `assets/brands/`. BYD usa sólo texto, sin descargar un logo de otra fuente. Todos tienen fallback tipográfico; la impresión usa texto legible sin depender de fondos. No se descargaron fotos ni fuentes externas. No se afirma aprobación oficial de ninguna marca.

Fuentes, fecha de consulta y límites de uso: **[`assets/ATTRIBUTION.md`](./assets/ATTRIBUTION.md)**. La autorización definitiva para usar marcas, logos y fotografías debe confirmarse antes de una publicación comercial; esta POC no afirma una autorización oficial de FIAT.
