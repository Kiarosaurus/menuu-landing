# Arquitectura de datos de Menúu consumidores

## Estado implementado

La app usa PostgreSQL como fuente de verdad. El esquema está en `server/migrations/0001_initial.sql`; `scripts/migrate.mjs` aplica migraciones una sola vez con bloqueo entre procesos. `server/repository.mjs` consulta catálogo, usuarios, sesiones y pedidos. La reserva valida opciones, horario y cupos, actualiza el cupo y guarda pedido e ítems dentro de una transacción PostgreSQL.

| Tabla | Contenido |
| --- | --- |
| `kitchens` | Cocinas y datos públicos. |
| `users` | Estudiantes y cuentas de cocina, correo único, hash de contraseña, datos académicos y fecha de nacimiento opcional. |
| `dishes` | Plato, cocina y precio base en céntimos. |
| `option_groups`, `option_choices` | Selección única o múltiple, obligatoriedad, límite y extras. |
| `offers` | Plato y fecha, horario, capacidad y cantidad reservada. |
| `orders`, `order_items`, `order_item_choices` | Reserva, platos, opciones, comentarios y copia histórica de nombres y precios. |
| `sessions` | Sesiones persistentes con hash SHA-256 del token y vencimiento. |
| `booking_requests` | Claves de solicitud para evitar reservas duplicadas al reintentar. |
| `order_reviews`, `order_item_reviews` | Puntuación de 1 a 5 de la cocina y de cada plato de un pedido entregado. |

Los importes se guardan como céntimos enteros. La actualización de `offers.reserved_count` exige que no se supere `capacity` y que el cierre aún no haya pasado. El pedido y sus opciones se insertan en la misma transacción; si algo falla, el cupo no queda descontado. Las claves foráneas y restricciones protegen las relaciones y valores básicos.

## Datos anteriores y arranque

`scripts/import-json.mjs` importa el antiguo `server/data/db.json`. No borra el archivo ni lo usa después. Importa hashes de contraseña, platos y reservas, incluidas opciones y precios originales. Si se repite, no duplica reservas y no sustituye cuentas o menús ya presentes. Debe ejecutarse antes de abrir tráfico real.

`scripts/seed-demo.mjs` crea tres cocinas, sus cuentas de muestra y ofertas de esta semana y la siguiente. `0003_kitchen_logos.sql` añade el logo público de cada cocina. El arranque `npm run dev` también aplica las migraciones y esa semilla; `npm start` aplica migraciones sin datos de prueba. Las ofertas reales deberán ser administradas por la futura app de cocinas.

El catálogo suma `order_items.quantity` por plato y cocina solo en pedidos marcados como entregados. No guarda cifras de ventas de ejemplo. Si todavía no hay entregas, Inicio presenta platos y cocinas para descubrir sin llamarlos «más vendidos». La puntuación de cada cocina se calcula con `order_reviews.kitchen_rating` de entregas confirmadas; sin reseñas se devuelve `null` y se muestra «Aún sin puntuación».

`0005_delivery_reviews.sql` añade `orders.fulfillment_status` y `orders.review_enabled`, ambos independientes. Una reseña solo puede crearse por el propietario del pedido si `fulfillment_status='delivered'`, `review_enabled=true` y pasó la hora de entrega. La API exige una nota para cada ítem y una para la cocina, con una sola reseña por pedido. Un pedido `pending` no habilita reseña ni implica ausencia. Solo un `no_show` explícito restringe las reservas futuras del estudiante; corregir ese estado revierte la restricción.

**Pendiente para la futura app de cocinas:** añadir usuarios superusuarios con asignaciones explícitas a una o más cocinas. Su interfaz mostrará únicamente los pedidos de las cocinas asignadas y permitirá, por pedido, confirmar la entrega o registrar que no se recogió y habilitar la reseña. El backend deberá comprobar esa asignación en cada lectura y actualización, registrar quién efectuó el cambio y cuándo, y no conceder acceso por el simple hecho de tener una cuenta de cocina. No se construirá una app separada para delivery en esta etapa. Hasta contar con esa interfaz, los cambios de estado y habilitación solo pueden hacerse como operaciones internas de desarrollo o administración en PostgreSQL; la app de consumidores no ofrece esos controles.

## Landing

La landing conserva su lista de espera en Cloudflare D1 (`menuu-landing/db/schema.ts`). D1 es SQL basado en SQLite y esa tabla no interviene en reservas ni cupos. Integrar la lista de espera con cuentas reales requerirá una importación o sincronización explícita; no hay dos fuentes de verdad para los pedidos.

## Trabajo posterior

La gestión de platos y ofertas por las cocinas, la verificación de propiedad del correo UTEC y el procesamiento de pago no forman parte de esta migración. Antes de publicar reservas reales, configurar copias de seguridad, supervisión y un proveedor PostgreSQL persistente. El cliente envía una clave de solicitud con cada reserva; la API devuelve el resultado guardado si recibe de nuevo la misma solicitud.

Referencias: [transacciones de node-postgres](https://node-postgres.com/features/transactions), [restricciones de PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html), [actualizaciones condicionadas](https://www.postgresql.org/docs/current/sql-update.html) y [Cloudflare D1](https://developers.cloudflare.com/d1/).
