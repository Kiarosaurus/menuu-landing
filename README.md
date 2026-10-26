# Menúu

Landing de lanzamiento para estudiantes de UTEC: comida de pequeños emprendimientos, entrega en la cafetería y pago con QR al recibir. No se reciben pedidos ni se procesan pagos desde esta página.

## Desarrollo

Proyecto desarrollado con Next.js 16 (App Router), React 19, Tailwind CSS y Drizzle ORM con LibSQL. Requiere Node.js 20.0.0 o superior y `pnpm`.

Para iniciar en local:

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000). En desarrollo local, la base de datos se crea y gestiona automáticamente en un archivo local (`file:local.db`).

### Scripts disponibles

- `pnpm dev`: Inicia el servidor de desarrollo de Next.js.
- `pnpm build`: Genera el build optimizado de producción.
- `pnpm start`: Inicia el servidor de producción.
- `pnpm lint` / `pnpm lint:fix`: Ejecuta ESLint (con opción de auto-fix).
- `pnpm format` / `pnpm format:check`: Formatea o valida el código con Prettier.

El repositorio incluye **Husky** y **lint-staged**: cada `git commit` ejecuta automáticamente el formateo y linter sobre los archivos staged para garantizar el estilo antes de confirmar cambios.

## Base de Datos y Variables de Entorno

El formulario envía `POST /api/inscripciones` y registra únicamente correos institucionales `@utec.edu.pe` (normalizados en minúsculas) en la tabla `leads`, junto con la fecha y versión del consentimiento.

- **Local:** Utiliza SQLite mediante `@libsql/client` (`file:local.db`). No requiere variables de entorno por defecto.
- **Producción:** Compatible con bases serverless LibSQL / Turso.
- Consulta [`.env.example`](./.env.example) para ver la plantilla de variables de entorno:
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`

La tabla se crea automáticamente al primer inicio si no existe. Incluye validación en cliente/servidor, verificación de origen y trampa honeypot contra bots.

## Despliegue en Vercel

El proyecto está listo para ser desplegado en **Vercel**:

1. **Vía Git (Recomendado):** Conecta este repositorio en el [Vercel Dashboard](https://vercel.com/dashboard) para despliegues continuos automáticos en cada `git push`.
2. **Vía CLI:**
   ```bash
   npx vercel@latest        # Despliegue de Preview
   npx vercel@latest --prod # Despliegue a Producción
   ```

En las variables de entorno del proyecto en Vercel (`Settings` -> `Environment Variables`), agrega `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` para la persistencia de las inscripciones en producción.

## Contenido

No hay precios, negocios participantes, testimonios ni fechas de lanzamiento inventados. Las imágenes de comida son referenciales. Se usan Fredoka y DM Sans. Los medios concretos compatibles con QR y los horarios se anunciarán con el lanzamiento.

La identidad gráfica de Menúu es una propuesta inicial. No se usa el logotipo de UTEC ni se presenta el proyecto como una aplicación oficial de la universidad.
