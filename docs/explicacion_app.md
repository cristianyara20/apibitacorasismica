# 📱 Guía de Entendimiento Total: App Móvil en Flutter (Sensores, SQLite y Riverpod)

> **Dirigido a:** Cualquier persona que quiera entender cómo funciona la aplicación móvil desde cero, sin tecnicismos difíciles.

---

## 🧭 1. ¿Qué hace la aplicación móvil en palabras sencillas?

La aplicación móvil es como una **caja negra de avión** instalada en el teléfono del encargado de transportar equipos delicados en el SENA CEET:
1. **Siente los movimientos en vivo:** Lee el sensor acelerómetro del celular miles de veces por segundo y muestra en pantalla cuánto se está moviendo el teléfono en los 3 ejes ($X, Y, Z$).
2. **Detecta accidentes:** Si alguien tropieza, deja caer una caja o frena bruscamente, la app siente el golpe que supera el umbral de seguridad, hace vibrar el celular (pulso háptico) y le pide las coordenadas al GPS.
3. **Nunca pierde información (Offline-First):** Si estás en un sótano o ascensor sin internet, la app **guarda el impacto primero en la memoria interna del teléfono (SQLite)**. En cuanto vuelves a tener WiFi o datos móviles, la app envía automáticamente todos los impactos pendientes al servidor en la nube sin que tengas que hacer nada.

---

## 📁 2. Estructura de Carpetas de la App (`app/`)

```text
app/
├── lib/
│   ├── datos/
│   │   ├── local/
│   │   │   └── cola_local.dart        # 💾 Base de datos SQLite dentro del celular
│   │   └── servicios/
│   │       ├── api_eventos.dart       # 📡 El mensajero que habla con el Backend en la nube
│   │       └── vigia_impactos.dart    # 🚨 El vigilante de los sensores (Acelerómetro + GPS)
│   ├── dominio/
│   │   └── evento_impacto.dart        # 📦 El molde / tarjeta de identidad de un impacto
│   ├── presentacion/
│   │   ├── monitor_page.dart          # 📊 Vista complementaria de monitoreo
│   │   └── providers.dart             # 🧠 El cerebro reactivo (Riverpod) que conecta todo
│   └── main.dart                      # 🎨 La pantalla principal con pestañas, botones y medidor
├── web/
│   └── index.html                     # 🌐 Configuración para abrir la app en navegadores web
├── android/app/src/main/
│   └── AndroidManifest.xml           # 🤖 Permisos de sensores y GPS para Android
└── pubspec.yaml                       # 📦 La lista de librerías y plugins de Flutter
```

---

## 📄 3. Explicación Archivo por Archivo

---

### 1️⃣ `pubspec.yaml` — *La Lista de Paquetes de la App*
- **¿Qué es?** Es el archivo de configuración principal de Flutter.
- **¿Qué paquetes esenciales utiliza?**
  - `sensors_plus`: Lee los movimientos físicos del celular ($X, Y, Z$).
  - `geolocator`: Obtiene la latitud, longitud y precisión satelital.
  - `sqflite`: Base de datos SQLite local para no perder datos si no hay red.
  - `flutter_riverpod` y `rxdart`: Actualizan la interfaz gráfica en tiempo real a medida que cambian los sensores.
  - `dio`: Hace las peticiones HTTP a la API REST de forma rápida y con reintentos.
  - `shared_preferences`: Guarda el ID único del celular en la memoria permanente del teléfono.

---

### 2️⃣ `lib/dominio/evento_impacto.dart` — *El Modelo de Datos del Impacto*
- **¿Qué es?** Es la clase que define **qué información compone un impacto**:
  - `claveCliente`: Un código UUID único generado en el teléfono (ej: `e8f4a120-...`).
  - `magnitud`: Fuerza del golpe (ej: `18.40 m/s²`).
  - `severidad`: Etiqueta (`leve`, `moderado` o `fuerte`).
  - `latitud` y `longitud`: Dónde ocurrió en el mapa.
  - `precisionM`: Margen de error del GPS en metros.
  - `ocurridoEn`: Fecha y hora exacta con milisegundos.
- **Métodos `toJson()` y `fromJson()`**: Convierten este objeto a texto JSON para enviarlo por internet o guardarlo en la base de datos local.

---

### 3️⃣ `lib/datos/local/cola_local.dart` — *La Base de Datos SQLite Interna (Offline-First)*
- **¿Qué hace?**
  - Crea una base de datos SQLite real dentro del almacenamiento del celular llamada `cola_eventos.db`.
  - **Función `encolar(evento)`**: En cuanto ocurre un golpe, lo guarda inmediatamente en el teléfono con estado `"pendiente"`.
  - **Función `obtenerPendientes()`**: Busca todos los impactos que aún no han podido subirse a la nube.
  - **Función `limpiar(claves)`**: Cuando el servidor confirma que ya recibió los impactos, esta función los borra de la cola local para liberar espacio.

---

### 4️⃣ `lib/datos/servicios/api_eventos.dart` — *El Conector con la Nube*
- **¿Qué hace?**
  1. **`registrarDispositivo()`**: Genera con `SharedPreferences` un nombre único para el teléfono (ej: `MOVIL-3A8F1C02`) y lo registra en la tabla `dispositivo` de Supabase la primera vez que abre la app.
  2. **`sincronizarPendientes()`**: Toma los eventos acumulados en `cola_local.dart`, los empaqueta y los envía a `POST /api/eventos/lote`. Si el servidor responde exitoso (`200` o `207`), le avisa a la cola local que los limpie.
  3. **`obtenerEventos()`**: Descarga el historial de impactos guardados en la nube para pintarlos en la pantalla.
  4. **`obtenerResumen()`**: Descarga los totales agrupados por día y severidad para alimentar las estadísticas.

---

### 5️⃣ `lib/datos/servicios/vigia_impactos.dart` — *El Corazón de los Sensores*
Es el archivo más importante de la detección física:
1. **Aislamiento de la Gravedad:**
   - La gravedad de la Tierra siempre empuja el celular a unos $9.8\text{ m/s}^2$.
   - El código calcula la magnitud total: $\sqrt{x^2 + y^2 + z^2}$ y le resta la gravedad:
     $$\text{Aceleración Neta} = |\sqrt{x^2 + y^2 + z^2} - 9.80665|$$
   - De esta forma, si el celular está quieto en una mesa, la aceleración neta marca $0.0\text{ m/s}^2$. Si lo sacudes, marca la fuerza real del movimiento.
2. **Tiempo de Reposo (Filtro Antirrebote - 900 ms):**
   - Un golpe físico fuerte hace vibrar el acelerómetro varias veces en un segundo.
   - El reposo de 900 milisegundos asegura que 1 solo golpe no se guarde falsamente como 5 golpes seguidos.
3. **Clasificación y Vibración Háptica:**
   - Menor a 15 $\text{m/s}^2$ ➔ `leve` (Vibración suave).
   - De 15 a 25 $\text{m/s}^2$ ➔ `moderado` (Vibración suave).
   - Mayor a 25 $\text{m/s}^2$ ➔ `fuerte` (Vibración fuerte / `heavyImpact`).
4. **Captura de GPS:**
   - Solicita permisos al usuario y captura latitud, longitud y precisión antes de armar el `EventoImpacto`.

---

### 6️⃣ `lib/presentacion/providers.dart` — *El Gestor de Estado Reactivo (Riverpod)*
- **¿Qué hace?**
  - Conecta la lógica con la pantalla sin mezclar código desordenado.
  - `dioProvider`: Provee el cliente HTTP configurado con la URL de producción (`https://apibitacorasismica.onrender.com`).
  - `telemetriaStreamProvider`: Entrega los valores $X, Y, Z$ en vivo a la pantalla cada milisegundo.
  - `impactoStreamProvider`: Dispara notificaciones visuales (SnackBars) instantáneamente cuando ocurre un nuevo impacto.
  - `eventosRemotosProvider` y `resumenApiProvider`: Proveen los datos de la base de datos remota para las listas y gráficas.

---

### 7️⃣ `lib/main.dart` — *La Interfaz Gráfica de Usuario (UI)*
Es lo que el usuario ve y toca en la pantalla. Contiene 3 pestañas principales:

1. **Pestaña 1: "Monitoreo"**:
   - **Botón Iniciar / Detener Monitoreo**: Activa o desactiva la escucha de los sensores.
   - **Tarjeta de Acelerómetro en Vivo**: Barra de progreso dinámica que cambia de color:
     - 🟢 **Verde**: Movimiento suave.
     - 🟠 **Naranja**: Movimiento moderado.
     - 🔴 **Rojo**: Movimiento brusco o peligroso.
   - **Chips de Ejes $X, Y, Z$**: Muestran los números en vivo de cada eje cartesiano del giroscopio/acelerómetro.
   - **Control Deslizante (Slider) de Umbral**: Permite ajustar la sensibilidad de disparo desde $3.0\text{ m/s}^2$ hasta $20.0\text{ m/s}^2$.
   - **Simulador de Impacto**: 3 botones de prueba (*Leve*, *Medio*, *Fuerte*) para probar el flujo completo en computadores o navegadores web que no tengan acelerómetro físico.
   - **Historial Local de la Sesión**: Lista los impactos detectados mientras la app ha estado abierta.
2. **Pestaña 2: "Eventos en BD"**:
   - Muestra la lista de impactos reales guardados en PostgreSQL (Supabase) consultando la API en tiempo real con botón de recarga (*Pull to Refresh*).
3. **Pestaña 3: "Resumen"**:
   - Muestra tarjetas de estadísticas con el total de impactos clasificados por gravedad (`leve`, `moderado`, `fuerte`) y por fecha.

---

## 🔄 4. Ciclo de Vida de un Impacto en la App

```mermaid
flowchart TD
    A[El teléfono sufre un golpe físico] --> B[vigia_impactos.dart lee acelerómetro X,Y,Z]
    B --> C{¿Aceleración neta > Umbral?}
    C -->|No| D[Solo actualiza la barrita verde en vivo]
    C -->|Sí| E{¿Pasaron más de 900ms desde el último golpe?}
    E -->|No| F[Se ignora por ser rebote del mismo golpe]
    E -->|Sí| G[Activa vibración háptica del celular]
    G --> H[Pide coordenadas al GPS geolocator]
    H --> I[Crea objeto EventoImpacto con UUID único]
    I --> J[Guarda en cola_local.dart SQLite dentro del celular]
    J --> K[Muestra alerta visual SnackBar en pantalla]
    K --> L{¿Hay conexión a Internet?}
    L -->|Sí| M[Envía POST /api/eventos/lote a la API en Render]
    M --> N[Servidor responde OK -> Borra de SQLite local]
    L -->|No (Modo Avión)| O[Queda guardado seguro en el teléfono para cuando regrese la red]
```
