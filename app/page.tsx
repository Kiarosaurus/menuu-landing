"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, ArrowRight, Check, MapPin, QrCode, Utensils, Store, ScanLine, Plus, X, ShoppingBag, Mail, Sparkles } from "lucide-react";

const steps = [
 { name: "Elige tu antojo", title: "Tu break tiene menú.", description: "Elige la comida que se te antoje entre las opciones de la semana.", icon: Utensils, tag: "01 / ELIGE", imageNote: "IMAGEN REFERENCIAL", image: "/images/arroz-con-pollo.webp", alt: "Arroz con pollo peruano y salsa criolla; imagen referencial" },
 { name: "Encuéntranos en la U", title: "Nos vemos en la cafetería.", description: "Recoge tu pedido en la cafetería de UTEC, entre clases.", icon: MapPin, tag: "02 / RECIBE", imageNote: "", image: "/images/utec-campus.webp", alt: "Vista del campus de UTEC, fotografía proporcionada para el punto de encuentro" },
 { name: "Paga con QR", title: "Primero llega. Luego pagas.", description: "Escanea el QR y paga cuando recibas tu pedido.", icon: QrCode, tag: "03 / PAGA", imageNote: "QR ILUSTRATIVO", image: "/images/menuu-qr-badge-v2.webp", alt: "Mano sosteniendo un carnet de Menúu con cinta para el cuello y un QR ilustrativo, no válido para pagos" },
];
const faqs = [
 ["¿Ya puedo hacer un pedido?", "Todavía no. Estamos preparando el lanzamiento de Menúu en UTEC. Deja tu correo y te avisaremos cuando puedas hacer tu primer pedido."],
 ["¿Dónde recibiré mi comida?", "El punto de entrega será la cafetería de UTEC. Los horarios disponibles y las instrucciones se comunicarán cuando lancemos Menúu."],
 ["¿Tengo que pagar por adelantado?", "No. El pago se realizará con QR al recibir el pedido en la cafetería. Los medios compatibles se comunicarán antes de realizar tu pedido."],
 ["¿De dónde viene la comida?", "Menúu busca conectar a estudiantes con pequeños emprendimientos de comida. Los negocios participantes y su oferta se anunciarán en el lanzamiento."],
];
function Logo() { return <a href="#inicio" className="logo" aria-label="Menúu, inicio"><img src="/images/menuu-logo.png" width="64" height="60" alt="" /><span className="brand-wordmark">Menúu</span></a>; }
export default function Home() {
 const [step, setStep] = useState(0);
 const howCopy = useRef<HTMLDivElement>(null);
 const [howHeight, setHowHeight] = useState<number | null>(null);
 const [email, setEmail] = useState("");
 const [consent, setConsent] = useState(false);
 const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
 const [error, setError] = useState("");
 const privacy = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  const element = howCopy.current;
  if (!element) return;
  const measure = () => setHowHeight(Math.ceil(element.getBoundingClientRect().height));
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  return () => observer.disconnect();
 }, []);
 useEffect(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
   if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
  }), { threshold: 0.1 });
  const elements = document.querySelectorAll(".benefits article, .section-top, .questions > div, .signup-copy, .signup-panel");
  elements.forEach(el => { el.classList.add("reveal"); observer.observe(el); });
  return () => { observer.disconnect(); elements.forEach(el => el.classList.remove("reveal")); };
 }, []);
 const current = steps[step]; const Icon = current.icon;
 async function submit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault(); if (status === "loading") return;
  if (!/^[^\s@]+@utec\.edu\.pe$/i.test(email.trim())) {
   setError("Usa tu correo institucional @utec.edu.pe.");
   setStatus("error");
   return;
  }
  const form = new FormData(e.currentTarget); setStatus("loading"); setError("");
  try {
   const response = await fetch("/api/inscripciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, consent, website: form.get("website") }) });
   const data = await response.json() as { error?: string; ok?: boolean };
   if (!response.ok) throw new Error(data.error || "No pudimos guardar tu correo. Inténtalo de nuevo.");
   setStatus("success");
  } catch (e) { setError(e instanceof Error ? e.message : "Revisa tu conexión e inténtalo de nuevo."); setStatus("error"); }
 }
 return <>
  <header className="nav"><div className="container nav-inner"><Logo /><nav aria-label="Navegación principal"><a href="#por-que">Por qué Menúu</a><a href="#como-funciona">Cómo funciona</a></nav><a className="button button-small" href="#lanzamiento">Únete a la lista <ArrowUpRight size={17} /></a></div></header>
  <main>
   <section className="hero container" id="inicio">
    <div className="hero-copy"><div className="eyebrow"><span className="live-dot" /> PRÓXIMAMENTE EN UTEC</div><h1>Tu antojo.<br />{" "}En la U.<br />{" "}<span className="highlight">Sin vueltas.<svg viewBox="0 0 420 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 13 Q190 -2 415 11" /></svg></span></h1><p className="hero-lead">Comida de pequeños emprendimientos, directo a la cafetería de UTEC. <strong>Recibes tu pedido y pagas con QR.</strong></p><div className="hero-actions"><a href="#lanzamiento" className="button">Únete a la lista de espera <ArrowUpRight size={20} /></a><a href="#como-funciona" className="text-link">Mira cómo funciona <ArrowRight size={16} /></a></div><div className="hero-note"><span className="hero-note-item"><Check size={15} /> Sin pago anticipado</span><span className="hero-note-separator" aria-hidden="true">·</span><span className="hero-note-item">Hecho para tu break</span></div></div>
    <div className="hero-art"><div className="art-orbit" /><div className="dish-photo"><img src="/images/tallarines-verdes.webp" alt="Tallarines verdes peruanos con bistec; imagen referencial" fetchPriority="high" /><span className="photo-label">TALLARINES VERDES · IMAGEN REFERENCIAL</span></div><span className="sticker">menos vueltas<br />{" "}<strong>más ñam.</strong><Sparkles size={24} /></span><div className="floating location"><span className="float-icon"><MapPin size={21} /></span><div><small>Nos encontramos en</small><strong>Cafetería de UTEC</strong></div><span className="tiny-dot" /></div><div className="floating payment"><span className="float-icon lime"><QrCode size={27} /></span><div><strong>Tu pedido llegó.</strong><small>Ahora sí, paga con QR <Check size={12} /></small></div></div><span className="side-note">el break se respeta ↗</span></div>
   </section>
   <div className="ticker"><div className="container ticker-inner"><span><Utensils size={20} /> Pequeños emprendimientos</span><i>✳</i><span><MapPin size={20} /> Un punto de encuentro</span><i>✳</i><span><QrCode size={20} /> QR al recibir</span><i>✳</i><span>100% pensado para la U</span></div></div>
   <section className="section container why"><div className="section-top" id="por-que"><div><span className="eyebrow">TU BREAK MERECE MÁS</span><h2>Entre clases pasan cosas.<br />{" "}<span className="muted">El hambre también.</span></h2></div><p>Queremos que encontrar algo rico sea la parte fácil de tu día. Y que cada pedido acerque un pequeño emprendimiento a la U.</p></div><div className="benefits"><article><span className="benefit-icon" aria-hidden="true"><Store strokeWidth={1.6} /></span><h3>Pequeños negocios.<br />{" "}Grandes antojos.</h3><p>Descubre propuestas de emprendimientos que quieren llegar a tu universidad.</p></article><article><span className="benefit-icon" aria-hidden="true"><MapPin strokeWidth={1.6} /></span><h3>Tu comida y tú.<br />{" "}En el mismo lugar.</h3><p>Entrega en la cafetería de UTEC. Un punto de encuentro que ya es parte de tu día.</p></article><article><span className="benefit-icon" aria-hidden="true"><ScanLine strokeWidth={1.6} /></span><h3>Pagas cuando<br />{" "}la tienes contigo.</h3><p>Escanea el QR al recibir tu pedido. Sin tener que pagar por adelantado.</p></article></div></section>
   <section className="how">
    <div className="container how-grid" id="como-funciona">
     <div className="how-copy" ref={howCopy}>
      <span className="eyebrow light">ASÍ DE SIMPLE</span>
      <h2>Tres pasos.<br />{" "}Un buen break.</h2>
      <p className="how-intro">Conoce cómo será tu pedido con Menúu, desde el primer antojo hasta la entrega.</p>
      <div className="step-tabs" role="tablist" aria-label="Pasos del pedido">
       {steps.map((item,i) => <button key={item.name} role="tab" id={`step-${i}`} aria-selected={step === i} aria-controls="step-panel" onClick={() => setStep(i)} className={step === i ? "selected" : ""}><span>0{i+1}</span>{item.name}<ArrowUpRight size={20} /></button>)}
      </div>
     </div>
     <div className="demo-frame" style={{ height: howHeight ? `${howHeight}px` : undefined }}>
      <div className="demo" role="tabpanel" id="step-panel" aria-labelledby={`step-${step}`}>
       <div className={`demo-visual demo-visual-step-${step}`} style={{ backgroundImage: `url("${current.image}")` }} key={`visual-${step}`}>
        <img src={current.image} alt={current.alt} loading="lazy" />
        <span className="demo-step"><Icon size={16} strokeWidth={1.8} /> {current.tag}</span>
        {current.imageNote && <span className="demo-image-note">{current.imageNote}</span>}
       </div>
       <div className="demo-footer" key={`footer-${step}`}>
        <div className="demo-summary"><h3>{current.title}</h3><p>{current.description}</p></div>
        {step < 2 ? <button className="button demo-button" onClick={() => setStep(step+1)}>Siguiente paso <ArrowRight size={18} /></button> : <a className="button demo-button" href="#lanzamiento">Únete a la lista <ArrowUpRight size={18} /></a>}
       </div>
      </div>
     </div>
    </div>
   </section>
   <section className="section container questions"><div><span className="eyebrow">SIN QUEDARTE CON LA DUDA</span><h2>Antes del<br />{" "}primer bocado.</h2><p>Menúu está en preparación.<br />{" "}Esto es lo que necesitas saber.</p></div><div className="faq-list">{faqs.map(([q,a]) => <details key={q}><summary>{q}<Plus size={20} /></summary><p>{a}</p></details>)}</div></section>
   <section className="signup-wrap"><div className="container signup" id="lanzamiento"><div className="signup-copy"><span className="eyebrow"><span className="live-dot" /> LISTA DE ESPERA · UTEC</span><h2>Que tu próximo<br />{" "}break tenga <em className="brand-wordmark">Menúu</em></h2><p>Déjanos tu correo y te avisaremos cuando lancemos Menúu. Tú pones el antojo.</p><span className="signup-note"><ShoppingBag size={18} /> Primero en UTEC. Pronto, en tu break.</span></div><div className="signup-panel">{status === "success" ? <div className="success" role="status"><span><Check size={30} /></span><h3>Tu antojo ya tiene lugar.</h3><p>Guardamos tu correo. Te avisaremos cuando lancemos Menúu en UTEC.</p><small>Esto es una inscripción a la lista de espera, no un pedido.</small></div> : <form onSubmit={submit}><h3>Entérate del lanzamiento</h3><p>Un correo para avisarte. Cero vueltas.</p><label htmlFor="email">Tu correo institucional</label><div className="email-field"><Mail size={18} /><input id="email" name="email" type="email" autoComplete="email" placeholder="tu@utec.edu.pe" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} pattern="[a-zA-Z0-9._%+-]+@utec[.]edu[.]pe" title="Usa tu correo institucional @utec.edu.pe" required /></div><div className="honeypot" aria-hidden="true"><label htmlFor="website">Sitio web</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div><label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required /><span>Acepto que Menúu use mi correo para avisarme del lanzamiento en UTEC. <button type="button" onClick={()=>privacy.current?.showModal()}>Ver privacidad</button></span></label><button className="button signup-button" type="submit" disabled={status === "loading"}>{status === "loading" ? "Guardando tu correo…" : "Quiero estar en la lista"}<ArrowUpRight size={20} /></button>{error && <p className="form-error" role="alert">{error}</p>}<small className="form-note">Registrarte no tiene costo ni te compromete a comprar.</small></form>}</div></div></section>
  </main>
  <footer className="site-footer"><div className="container footer-inner"><span className="footer-brand"><img src="/images/menuu-logo.png" width="37" height="35" alt="" />Menúu</span><p>Tu antojo tiene punto de encuentro.</p><button type="button" onClick={()=>privacy.current?.showModal()}>Política de privacidad</button></div></footer>
  <dialog ref={privacy} className="privacy-dialog"><button className="close-dialog" aria-label="Cerrar aviso de privacidad" onClick={()=>privacy.current?.close()}><X /></button><span className="eyebrow">TUS DATOS</span><h2>Tu correo, para el lanzamiento.</h2><p>Menúu guarda tu correo, la fecha de inscripción y tu aceptación de este aviso para avisarte del lanzamiento de Menúu en UTEC.</p><p>El registro no es un pedido ni un pago. No solicitamos datos bancarios. La lista de correos no es pública.</p><p>Puedes retirar tu interés respondiendo al correo que recibas y solicitar que eliminemos tu inscripción. No usaremos este registro para campañas de terceros.</p><p className="privacy-version">Aviso de privacidad</p><button className="button" onClick={()=>privacy.current?.close()}>Entendido <Check size={18} /></button></dialog>
 </>;
}
