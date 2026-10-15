# Grupo GRP + FIAT · Simulador de Financiación

POC navegable de una herramienta interna para vendedores: permite cotizar un vehículo FIAT, aplicar límites de financiación, comparar dos alternativas e imprimir los resultados como PDF.

**Todos los precios y las condiciones financieras son ficticios. No es una oferta comercial, una aprobación crediticia ni una cotización vinculante. No es una aplicación oficial de FIAT.** Actualización inicial: 15/10/2026.

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

- **Cotizador:** abre con una cotización precargada. Elegí modelo y versión, editá precio/anticipo en pesos enteros, tipo de cliente, plan y plazo. Presioná **Recalcular**. Al editar un dato se oculta el resultado anterior para evitar cotizaciones desactualizadas.
- **Comparador:** usa exactamente el mismo vehículo, precio y anticipo del cotizador. Elegí dos planes o plazos diferentes y compará. Se destaca el menor número de cada métrica, **no la “mejor” financiación**. Un capital financiado menor también se destaca; revisá la diferencia no financiada.
- **Datos de demostración:** muestra todas las condiciones, compatibilidades y vigencias. Un plan vencido se incluye a propósito en el catálogo, pero no se permite calcularlo ni compararlo.
- **Imprimir / Guardar PDF:** abre el diálogo nativo del navegador. Elegí “Guardar como PDF”. Se imprime el resultado de la sección actual, con marca tipográfica, fechas y advertencias, sin controles. No hace falta habilitar fondos de impresión. En la vista de datos, Ctrl+P imprime la última cotización válida, si existe.
- **Limpiar:** borra la cotización y la selección persistida. No se piden datos personales. Sólo se guarda la última selección válida recalculada/comparada, localmente, bajo `grp-finance-poc:v1`. Si el almacenamiento está bloqueado o corrupto, la aplicación sigue funcionando.

## Estructura

```text
.
├── index.html                 # HTML semántico, formulario, pestañas y resultados
├── styles.css                 # Diseño responsive y estilos de impresión
├── js/
│   ├── app.js                 # Interfaz, validación, comparación y persistencia
│   ├── calculator.js          # Motor puro de cálculo, sin DOM ni tasas propias
│   └── demo-data.js           # Única fuente de modelos, precios y planes ficticios
├── assets/
│   ├── grp-logo.png
│   ├── fiat-logo.png
│   ├── favicon.png
│   └── ATTRIBUTION.md         # Fuentes y advertencia sobre derechos de uso
├── tests/
│   └── calculator.test.mjs    # Pruebas sin dependencias externas
├── README.md
├── .gitignore                 # Excluye artefactos locales y metadatos del sistema
└── .nojekyll
```

HTML, CSS propio y JavaScript vanilla con módulos ES. Sin framework, backend, proceso de compilación, dependencias de ejecución, fuentes remotas, claves ni variables de entorno. Todas las rutas del sitio son relativas, compatibles con una subcarpeta de GitHub Pages.

## Editar modelos y planes

Editá únicamente **`js/demo-data.js`** para cambiar la información de la demo y después recargá el navegador:

- `DEMO_META.updatedAt`: fecha de actualización en formato `AAAA-MM-DD`.
- `MODELS`: modelos con `id` único, nombre, categoría y una lista de `versions`. Cada versión tiene su propio `id`, `name` y `price` ficticio en pesos. Cambiar modelo actualiza sus versiones; cambiar versión carga su precio demo y conserva el anticipo ingresado para revisarlo.
- `CUSTOMER_TYPES`: identificadores y etiquetas para personas físicas/jurídicas.
- `PLANS`: entre seis y ocho planes. Cada uno incluye `id`, **`demo: true`**, `entity`, `name`, `currency: 'ARS'`, `customerTypes`, `modelIds`, `terms`, `validFrom`, `validTo` y `notes`. Los identificadores referenciados deben existir.
- Cada plazo contiene `months`, `tna`, `cft`, `maxLtvPct`, `maxAmount`, `expensePct` e `installmentCoefficient`. Las tasas y porcentajes se expresan como números porcentuales: `36` significa 36%; el coeficiente se expresa como factor decimal: `0.0578`, no `5.78`.
- Usá `installmentCoefficient: null` para aplicar la fórmula de cuota fija. Usá TNA `0` y coeficiente `null` para capital / meses.
- `DEFAULT_SELECTION`: modelo, versión, plan, plazo, porcentaje de anticipo y alternativas iniciales. Mantené estas referencias compatibles al editar el catálogo.

La vigencia se evalúa con **la fecha local del dispositivo**, incluyendo ambos extremos. No se congela en la fecha de actualización: los planes activos del ejemplo vencen el 31/12/2027. Después será necesario actualizar sus fechas demo para volver a usarlos. Los planes futuros, vencidos o incompatibles se excluyen de los selectores; el motor vuelve a validarlos en cada cálculo. Un dato guardado inválido se descarta. Si cambiás el formato de persistencia, incrementá la versión de la clave en `js/app.js`.

## Fórmulas

Sean `P` el precio de lista, `A` el anticipo y `n` la cantidad de meses:

```text
solicitado          = P − A
límite LTV          = P × maxLtvPct / 100
capital elegible    = mínimo(solicitado, límite LTV, maxAmount)
gastos estimados    = capital elegible × expensePct / 100
diferencia          = solicitado − capital elegible
anticipo necesario  = P − capital elegible
```

El capital elegible se redondea **hacia abajo a pesos enteros**, para nunca sobrepasar un tope por redondeo. Los otros resultados monetarios se redondean al peso más cercano. Los campos aceptan pesos enteros, con o sin separadores de miles (`32000000` o `32.000.000`).

Orden de prioridad para la cuota:

1. **Coeficiente definido:** `cuota = capital elegible × installmentCoefficient`.
2. **Sin coeficiente, TNA mayor que cero:** sistema francés. Con `i = tna / 100 / 12`:

   ```text
   cuota = capital elegible × i / (1 − (1 + i)^(-n))
   ```

3. **Sin coeficiente y TNA cero:** `cuota = capital elegible / n`.

`total nominal estimado = cuota redondeada × n`. Por ese redondeo puede diferir unos pesos del cálculo sin redondear. No se construye un cronograma ni se ajusta una última cuota. **Los gastos no se financian ni se suman a la cuota.** El total de cuotas no incluye el anticipo, gastos, seguros, impuestos ni otros cargos. El CFT es un dato ilustrativo informado por el plan: no se deriva, no se audita ni se usa como tasa de cálculo. No se proyectan UVA ni inflación.

## Pruebas y controles

Opcionalmente, con Node.js moderno (22 o posterior recomendado), sin instalar paquetes:

```bash
node --test tests/calculator.test.mjs
```

Las pruebas cubren cuota por coeficiente, sistema francés, tasa cero, validaciones, vigencia, compatibilidad, topes, redondeo y más de mil escenarios determinísticos de invariantes.

Casos manuales reproducibles con **FIAT Financiera Demo → Impulso inicial → 24 meses**:

| Caso | Precio | Anticipo | Resultado esperado |
| --- | ---: | ---: | --- |
| Normal | $32.000.000 | $12.800.000 | Financia $19.200.000; cuota $1.109.760 |
| Límite LTV | $20.000.000 | $1.000.000 | Financia $14.000.000; faltan $5.000.000 |
| Tope de monto | $60.000.000 | $30.000.000 | Financia $20.000.000; faltan $10.000.000 |
| Anticipo inválido | $32.000.000 | $33.000.000 | Error junto al anticipo; cálculo deshabilitado |

También conviene revisar cambio de modelo/versión, filtrado por persona jurídica, comparación, planes vencidos, navegación con teclado, impresión A4, ancho móvil de 390 y 360 px, rutas bajo subcarpeta y logos bloqueados. La consola no debe tener errores durante el recorrido normal.

## Límites de la POC

- No hay evaluación crediticia, integración bancaria, disponibilidad comercial ni condiciones reales.
- No calcula seguros, sellos, impuestos, gastos registrales, inflación, UVA ni CFT efectivo. Tampoco es un plan de ahorro.
- No hay login ni panel administrativo. No se piden ni almacenan nombres, documentos, teléfonos u otros datos personales.
- No envía datos de cotizaciones a terceros. `localStorage` es sólo una comodidad del navegador, no una base de datos ni un archivo compartido de cotizaciones.
- El reloj del dispositivo determina la vigencia; una solución productiva necesitaría una fuente confiable y controles adicionales.
- `noindex` es una sugerencia para buscadores, **no un control de acceso**. Los archivos publicados son públicos.

## Antes de reemplazar los datos demo por datos reales

- [ ] Obtener autorización de GRP y de los titulares para usar nombres, marcas, logos y cualquier otro activo.
- [ ] Obtener catálogo, disponibilidad y precios aprobados, con responsable y fecha de revisión.
- [ ] Acordar con cada entidad tasas, CFT, coeficientes, plazos, topes, requisitos, vigencia y compatibilidades reales; no limitarse a cambiar `demo: true`.
- [ ] Validar fórmulas, redondeos, gastos, impuestos, seguros y alcance legal con responsables financieros y de cumplimiento.
- [ ] Definir una fuente controlada de datos, revisión, trazabilidad, permisos y un mecanismo confiable de vencimientos.
- [ ] Agregar pruebas de las condiciones contractuales y accesibilidad; definir soporte para navegadores.
- [ ] Revisar textos, avisos legales y condiciones antes de modificar el carácter ilustrativo de la herramienta.
- [ ] Confirmar que no haya información confidencial ni secretos en archivos, historial o almacenamiento del sitio.

## Publicar en GitHub Pages

**Subir los archivos al repositorio no habilita GitHub Pages.** Para publicar el sitio cuando cuentes con autorización:

1. Creá un repositorio nuevo en GitHub.
2. Subí todos los archivos del proyecto a la rama **`main`**, incluyendo `assets/`, `js/` y el archivo oculto `.nojekyll`. `index.html` debe quedar en la raíz, no dentro de otra carpeta. No subas PDFs de prueba ni archivos confidenciales.
3. Abrí **Settings → Pages**.
4. En “Build and deployment”, seleccioná **Deploy from a branch**.
5. Elegí la rama **main** y la carpeta **/ (root)**.
6. Guardá y esperá la URL **`https://USUARIO.github.io/REPOSITORIO/`**. Puede demorar unos minutos.

No se necesita GitHub Actions ni un comando de compilación. Las rutas relativas funcionan directamente bajo `/REPOSITORIO/`.

**GitHub Pages publica el sitio en Internet. Esta POC no debe contener datos internos confidenciales.** Un repositorio privado no garantiza que el sitio de Pages sea privado. Confirmá el permiso para exponer la demo y sus activos antes de habilitar Pages.

## Marcas y activos

Se descargaron localmente los dos logos y el favicon de los recursos públicos proporcionados de Grupo GRP. Hay respaldo tipográfico `GRP` y `FIAT` si no cargan; la impresión usa identificación tipográfica legible sin depender de fondos. No se descargaron fotos ni fuentes externas. Las referencias funcionales no aportaron código ni condiciones financieras.

Fuentes, fecha de consulta y límites de uso: **[`assets/ATTRIBUTION.md`](./assets/ATTRIBUTION.md)**. La autorización definitiva para usar marcas, logos y fotografías debe confirmarse antes de una publicación comercial; esta POC no afirma una autorización oficial de FIAT.
