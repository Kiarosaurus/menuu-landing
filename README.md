# Menúu · consumidores

App de estudiantes y cocinas con catálogo semanal, personalización, reservas, pedidos y estadísticas. La fuente de verdad es **libSQL**: un archivo SQLite en local y una base **Turso** remota en producción. La lista de espera de `menuu-landing` usa otra base Turso independiente.

## Desarrollo local

Requiere Node.js 22.13 o posterior. No requiere Docker ni PostgreSQL.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Abre [http://127.0.0.1:5174/#inicio](http://127.0.0.1:5174/#inicio). Sin `TURSO_DATABASE_URL`, los datos se guardan en `local.db` dentro de este proyecto. `npm run dev` aplica el esquema y no crea usuarios, cocinas ni ofertas ficticias. La base local anterior de PostgreSQL quedó archivada; la cuenta de estudiante que no era de muestra se conservó en `local.db`.

| Comando | Función |
| --- | --- |
| `npm run dev` | Sirve API y frontend con Vite. |
| `npm run build` | Compila el frontend. |
| `npm start` | Sirve la versión compilada. |
| `npm run db:migrate` | Aplica las migraciones libSQL pendientes. |
| `npm run test:libsql` | Prueba el esquema y los flujos críticos en una base temporal. |

Las cuentas de estudiante se registran con `@utec.edu.pe`, código numérico único de nueve dígitos y carrera de la lista UTEC. El acceso de cocina requiere una cuenta asignada internamente a su cocina; no existe registro público de cocinas.

## Vercel y Turso

Configura **Root Directory** como `menuu-consumidores`. El proyecto ya incluye `vercel.json` y una función para `/api/*`. Crea una base Turso **para consumidores**; no reutilices la base de inscripciones de la landing. En Vercel configura estas variables para Production y Preview:

```text
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

La función aplica las migraciones al recibir su primera petición. Una base nueva comienza sin usuarios ni menús. No subas `local.db`, `.env` ni el token al repositorio. Comprueba `/api/bootstrap` en la URL desplegada: debe responder JSON con `catalog.kitchens` y `catalog.offerings`, inicialmente vacíos. Si devuelve un error, revisa los registros de la función en Vercel.

La app guarda reservas en transacciones de escritura libSQL. Cada reserva comprueba otra vez el plazo y el cupo, actualiza el stock de forma condicionada y crea el pedido en la misma transacción. Una clave de solicitud hace seguros los reintentos. El servidor valida también las opciones de personalización y los precios. El pago por QR se hace al recibir la comida; esta web no procesa pagos.

## Datos y reglas

El esquema nuevo está en `server/migrations/0001_initial.sql`. Las migraciones PostgreSQL anteriores se conservan solo como referencia en `docs/postgres-migrations/`; ya no se ejecutan. Consulta [docs/arquitectura-datos.md](docs/arquitectura-datos.md) para las tablas y garantías de datos.

Los consumidores ven esta semana y la siguiente. Una cocina puede publicar platos solo en ciertos días de lunes a sábado. Cada oferta tiene fecha, ventana de recojo, cierre de reserva y capacidad propios. Los pedidos marcados como entregados permiten calcular ventas; las reseñas requieren además una habilitación interna y la hora de entrega cumplida. La función de superusuario que gestionará entregas y ausencias sigue pendiente.
