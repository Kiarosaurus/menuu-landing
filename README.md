# Menúu · consumidores

App web de consumidores con catálogo semanal, personalización, carrito, cuentas UTEC y reservas. Usuarios, cocinas, platos, opciones, ofertas, pedidos y sesiones se guardan en **PostgreSQL**. La landing mantiene su lista de espera independiente en Cloudflare D1.

## Probar en local

Requiere Node.js 22.13+ y PostgreSQL. Con Docker Desktop:

```powershell
docker compose up -d
Copy-Item .env.example .env
npm install
npm run dev
```

Abre `http://127.0.0.1:5174/#inicio`. `npm run dev` aplica las migraciones pendientes y carga idempotentemente tres cocinas, sus menús y las cuentas de prueba en la base indicada por `DATABASE_URL`.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Estudiante | `alex.demo@utec.edu.pe` | `MenuuEstudiante2026!` |
| Cocina, preparada para la futura app | `cocina.demo@menuu.test` | `MenuuCocina2026!` |
| Chaufa Club | `chaufa.club@menuu.test` | `MenuuChaufa2026!` |
| La Esquina Criolla | `esquina.criolla@menuu.test` | `MenuuCriolla2026!` |

La cuenta de cocina no puede entrar en la app de consumidores. El registro público crea solo estudiantes con dominio `@utec.edu.pe`, código de estudiante numérico y único de 9 dígitos y una carrera de la lista de pregrado de UTEC. La cuenta de prueba usa el código `999900001` y Ciencia de la Computación. Las contraseñas usan `scrypt` con sal individual. Las credenciales de muestra solo deben usarse en una base de desarrollo.

Las migraciones `0007_numeric_student_codes.sql` y `0008_nine_digit_student_codes.sql` exigen códigos numéricos de 9 dígitos en registros y cambios futuros. Conservan los códigos anteriores de cuentas reales para no sustituir su identidad sin confirmar; al editar su perfil, el estudiante debe corregir el código. La cuenta de muestra se actualiza a `999900001`.

Si ya tenías el servidor abierto, detenlo y vuelve a ejecutar `npm run dev`: los cambios del backend no se cargan con la actualización en caliente de Vite.

## Migrar el archivo JSON anterior

`server/data/db.json` ya no se usa en ejecución. Si quieres conservar sus cuentas y pedidos, **impórtalo antes de arrancar la app o cargar los datos de prueba**:

```powershell
npm run db:migrate
npm run db:import-json
npm run dev
```

El importador lee `server/data/db.json` por defecto. Para otro archivo, ejecuta `npm run db:import-json -- D:\ruta\a\db.json`. Conserva hashes de contraseñas, pedidos, opciones, comentarios y precios históricos. Puede ejecutarse otra vez sin duplicar pedidos y no reemplaza cuentas ni platos que ya existan en PostgreSQL. Las sesiones anteriores vivían solo en memoria: hay que iniciar sesión de nuevo.

## Comandos y despliegue

| Comando | Función |
| --- | --- |
| `npm run db:migrate` | Aplica las migraciones SQL pendientes. |
| `npm run db:seed:demo` | Carga explícitamente la cocina y las cuentas de prueba. |
| `npm run db:import-json` | Importa el JSON anterior. |
| `npm run build` | Compila el frontend. |
| `npm start` | Sirve la versión compilada; no carga datos de prueba. |
| `npm run test:smoke` | Prueba la API y reservas concurrentes en un esquema PostgreSQL temporal. |

En la nube, configura `DATABASE_URL` con una conexión PostgreSQL persistente y TLS según el proveedor, ejecuta `npm run db:migrate`, luego `npm run build` y `npm start`. Si el servidor debe aceptar conexiones externas, define `HOST=0.0.0.0`; `PORT` fija el puerto. `TEST_DATABASE_URL` debe apuntar a una base de pruebas: el test crea y elimina únicamente un esquema temporal propio.

## Menú y reservas

La Olla de la U publica arroz con pollo y tallarines verdes; Chaufa Club publica chaufa de pollo; La Esquina Criolla publica lomo saltado y ají de gallina. Cada cocina ofrece platos solo ciertos días de la semana actual y la siguiente. Cada oferta guarda en PostgreSQL su propia fecha y hora límite de reserva (`booking_deadline_at`), que siempre precede a la entrega. La semilla fija el plazo del chaufa del jueves dos días antes; los demás platos de muestra cierran un minuto antes de su entrega. El recojo de la muestra es de 1:00 a 1:10 p.m. Al volver a cargar la semilla, solo se actualizan plazos que todavía conservan el valor inicial de un minuto.

El arroz con pollo permite elegir salsa criolla y ají y hasta dos extras; el chaufa permite pedir ají aparte. Todo plato admite un comentario opcional de hasta 200 caracteres. Las reglas de cada grupo viven en `option_groups` y `option_choices`, con tipo de selección, obligatoriedad y límite.

Inicio muestra dos platos destacados en un carrusel de dimensiones iguales y enlaza a `#menu/cocina/{id}`. En escritorio, cada título y descripción del carrusel tiene dos líneas. Cambia de plato cada cinco segundos, se pausa al interactuar y ofrece controles sobre la imagen; respeta la preferencia de reducir movimiento. El catálogo con filtros de semana, día y cocina vive solo en `#menu`. Los platos destacados de Inicio se ordenan por porciones de reservas confirmadas para la semana de recojo y, en empate, por número de pedidos; se muestra la primera fecha futura reservable de cada plato. Si ya no quedan platos esta semana, se usa la siguiente. Sin reservas semanales se presenta una selección para descubrir, sin atribuirle ventas. Cada tarjeta separa la fecha y hora límite de reserva de la fecha y ventana de recojo; no repite el punto fijo de entrega. Las descripciones de platos tienen un máximo de 90 caracteres en PostgreSQL y se muestran en hasta tres renglones. Una descripción corta solo deja espacio adicional si otra tarjeta de la fila necesita más altura. El ranking de cocinas sigue usando unidades de pedidos **entregados**. Las tarjetas de cocinas muestran solo logo, nombre y puntuación verificada, o «Aún sin puntuación». Los logos también se muestran en los filtros y sobre las fotos de los platos. Las fotografías de chaufa, lomo saltado y ají de gallina muestran cada plato en un envase plástico descartable abierto y no contienen textos ni precios.

En `#menu`, semana, búsqueda y cocina comparten una barra compacta; los días ocupan una segunda línea desplazable. La cocina se elige en un desplegable con sus logos. Al buscar se muestra la cantidad de platos coincidentes, sin indicador de carga porque el filtrado es inmediato en el navegador. La página de cuenta presenta un acceso breve y el registro ofrece las 16 carreras publicadas en [Pregrado UTEC](https://utec.edu.pe/pregrado). El alta se realiza en dos pasos: correo UTEC y contraseña; luego nombre completo, código numérico, carrera y fecha de nacimiento opcional. Al completarla, el servidor inicia la sesión de esa cuenta. Con la sesión iniciada, el perfil muestra sus datos como texto. «Editar» abre los campos para cambiar nombre, código, carrera o fecha de nacimiento; «Cancelar» descarta los cambios y «Guardar cambios» vuelve a la vista de texto. También se puede cerrar sesión.

La ruta `#cuenta` conserva el patrón de cubiertos con o sin sesión. La fecha de nacimiento usa un calendario visual propio para elegir año, mes y día, con fechas futuras deshabilitadas y opción de quitarla.
En escritorio, los campos «Nombre completo» y «Carrera» ocupan una columna más ancha que «Código de estudiante» y «Fecha de nacimiento» en registro y perfil.

Cada reserva bloquea sus ofertas, valida el horario y las opciones, descuenta cupos y guarda pedidos e ítems en **una transacción**. Una clave por solicitud permite reintentar sin duplicar la reserva. Los precios y nombres elegidos se copian al pedido para conservar el historial si la cocina cambia su menú. Las sesiones también persisten en PostgreSQL. El pago figura como QR al recibir; no se procesa en la web.

## Entregas y reseñas

Cada pedido tiene `fulfillment_status` (`pending`, `delivered` o `no_show`) y `review_enabled`, inicialmente `false`. Queda pendiente una función de **superusuario en la futura app de cocinas**: cada usuario autorizado verá únicamente los pedidos de las cocinas que tenga asignadas y podrá confirmar la entrega y habilitar la reseña de esos pedidos. La autorización deberá verificarse en el servidor para cada consulta y cambio; una cuenta común de cocina no recibe ese permiso automáticamente. No existe todavía esa interfaz ni un control público para habilitar reseñas. Después de la hora de entrega, la persona que reservó puede puntuar de 1 a 5 la cocina y cada plato una sola vez. El servidor valida propiedad, estado, habilitación, horario y que se puntúen todos los platos. La puntuación pública de una cocina es el promedio de sus reseñas válidas.

Mientras el estado sea `pending`, Pedidos muestra «Entrega por confirmar» después de la ventana de recojo. Solo un `no_show` explícito muestra que no se recogió y restringe nuevas reservas de esa cuenta. Corregir ese estado restablece la posibilidad de reservar. La ausencia de habilitación para reseñar **no** significa ausencia del estudiante. Estos comandos SQL sirven únicamente para preparar o verificar datos locales hasta construir la interfaz de superusuario:

```sql
UPDATE orders SET fulfillment_status = 'delivered', review_enabled = true WHERE id = 'ID_DEL_PEDIDO';
UPDATE orders SET fulfillment_status = 'no_show', review_enabled = false WHERE id = 'ID_DEL_PEDIDO';
```

La interfaz de administración para que las cocinas editen platos y ofertas aún no existe. El esquema y las tablas están listos para construirla. Más detalles en [docs/arquitectura-datos.md](docs/arquitectura-datos.md).

