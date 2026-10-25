# Menúu

Landing de lanzamiento para estudiantes de UTEC: comida de pequeños emprendimientos, entrega en la cafetería y pago con QR al recibir. No se reciben pedidos ni se procesan pagos desde esta página.

## Desarrollo

Proyecto React con Vinext y Cloudflare Workers. Requiere Node.js 22.13 o superior. En Windows, si `pnpm` no está disponible o Corepack falla, ejecuta desde esta carpeta:

```powershell
npx --yes pnpm@11.25.0 install --frozen-lockfile
npx --yes pnpm@11.25.0 db:local:migrate
npx --yes pnpm@11.25.0 dev
```

Abre `http://127.0.0.1:5173/`. La migración solo prepara la base D1 local y puede repetirse; no modifica la base publicada. Si ya tienes `pnpm`, puedes usar `pnpm install`, `pnpm db:local:migrate` y `pnpm dev`. Para compilar, ejecuta `npx --yes pnpm@11.25.0 build`.

El formulario envía `POST /api/inscripciones` y guarda únicamente correos `@utec.edu.pe`, normalizados en minúsculas, en D1 junto con fecha y versión del consentimiento. La validación se ejecuta tanto en el navegador como en el servidor. No hay una ruta pública de lectura. Una clave primaria evita correos duplicados; las respuestas de registro no revelan si el correo ya existía. Incluye verificación de origen y campo trampa contra bots.

## Publicación y GitHub

La primera versión se publica como vista privada con Sites. No se ha creado ni modificado un repositorio de la cuenta de GitHub del usuario.

Este código puede guardarse en un repositorio de GitHub. La versión completa requiere un runtime compatible con Cloudflare Workers y una base D1; no funciona íntegramente como un sitio de GitHub Pages, porque Pages no ejecuta la ruta de registro. Para alojar solo la parte visual en Pages habría que exportar una versión estática y conectar el formulario a un servicio externo. No publicar la base de datos, archivos de entorno ni credenciales en GitHub.

La configuración de Sites solicita el binding D1 `DB` en `.openai/hosting.json`; `db/index.ts` lo exige para guardar cada inscripción y la migración inicial está en `drizzle/`. Al publicar en Sites, configura la base D1 remota y aplica esa migración antes de aceptar registros. La base local de pruebas está separada de producción. El ID de base en `wrangler.local.jsonc` y en el build local es solo un identificador de desarrollo: para un despliegue independiente de Sites hay que crear una D1 remota, sustituir ese ID en la configuración de Wrangler y aplicar `drizzle/0000_optimal_rachel_grey.sql` en la base remota antes de publicar. La administración de la lista se realiza fuera de la landing pública.

## Contenido

No hay precios, negocios participantes, testimonios ni fechas de lanzamiento inventados. Las imágenes de comida son referenciales. Se usan Fredoka y DM Sans. Los medios concretos compatibles con QR y los horarios se anunciarán con el lanzamiento.

La identidad gráfica de Menúu es una propuesta inicial. No se usa el logotipo de UTEC ni se presenta el proyecto como una aplicación oficial de la universidad.
