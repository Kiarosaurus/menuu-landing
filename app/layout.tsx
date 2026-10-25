import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "Menúu · Tu antojo llega a UTEC",
 description: "Comida de pequeños emprendimientos, entrega en el comedor de UTEC y pago con QR al recibir. Entérate del lanzamiento de Menúu en UTEC.",
 icons: { icon: "/favicon.svg?v=3", shortcut: "/favicon.svg?v=3" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="es"><body>{children}</body></html>;
}
