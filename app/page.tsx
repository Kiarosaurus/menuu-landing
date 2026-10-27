"use client";
import {
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  MapPin,
  QrCode,
  Utensils,
  Plus,
  X,
  ShoppingBag,
  Mail,
  CircleAlert,
} from "lucide-react";
import Image from "next/image";
import Script from "next/script";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            hd?: string;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number | string;
              logo_alignment?: string;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const steps = [
  {
    name: "Elige tu antojo",
    title: "Tu break tiene menú.",
    description:
      "Elige la comida que se te antoje entre las opciones de la semana.",
    icon: Utensils,
    tag: "01 / ELIGE",
    imageNote: "IMAGEN REFERENCIAL",
    image: "/images/arroz-con-pollo.webp",
    alt: "Arroz con pollo peruano y salsa criolla en un envase plástico descartable; imagen referencial",
  },
  {
    name: "Encuéntranos en la U",
    title: "Nos vemos en el comedor.",
    description:
      "Recoge tu pedido en el comedor de UTEC, entre clases.",
    icon: MapPin,
    tag: "02 / RECIBE",
    imageNote: "",
    image: "/images/utec-campus.webp",
    alt: "Vista del campus de UTEC, fotografía proporcionada para el punto de encuentro",
  },
  {
    name: "Paga con QR",
    title: "Primero llega. Luego pagas.",
    description:
      "Escanea el QR y paga cuando recibas tu pedido.",
    icon: QrCode,
    tag: "03 / PAGA",
    imageNote: "QR ILUSTRATIVO",
    image: "/images/menuu-qr-badge-v2.webp",
    alt: "Mano sosteniendo un carnet de Menúu con cinta para el cuello y un QR ilustrativo, no válido para pagos",
  },
];
const faqs = [
  [
    "¿Ya puedo hacer un pedido?",
    "Todavía no. Estamos preparando el lanzamiento de Menúu en UTEC. Deja tu correo y te avisaremos cuando puedas hacer tu primer pedido.",
  ],
  [
    "¿Dónde recibiré mi comida?",
    "El punto de entrega será el comedor de UTEC. Los horarios disponibles y las instrucciones se comunicarán cuando lancemos Menúu.",
  ],
  [
    "¿Tengo que pagar por adelantado?",
    "No. El pago se realizará con QR al recibir el pedido en el comedor. Los medios compatibles se comunicarán antes de realizar tu pedido.",
  ],
  [
    "¿De dónde viene la comida?",
    "Menúu busca conectar a estudiantes con pequeños emprendimientos de comida. Los negocios participantes y su oferta se anunciarán en el lanzamiento.",
  ],
];

function BenefitIcon({
  kind,
  hero = false,
}: {
  kind: "store" | "location" | "qr";
  hero?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "store" && (
        <>
          <path d="M10 19h28v19H10z" fill="currentColor" />
          <path
            d="M9 11h30l3 9c-1.3 3-4.5 4.4-7.5 2.2-2.5 2.5-5.7 2.5-8.1 0-2.2 2.5-5.4 2.5-7.7 0-2.3 2.5-5.6 2.5-8.2 0C10.5 24.4 7.3 23 6 20z"
            fill="var(--orange-display)"
          />
          <path
            d="M16 27h7v11h-7zM27 27h7v6h-7z"
            fill="var(--benefit-cutout)"
          />
        </>
      )}
      {kind === "location" && (
        <>
          <path
            d="M24 5c-9.1 0-16 6.8-16 15.7C8 31.1 24 43 24 43s16-11.9 16-22.3C40 11.8 33.1 5 24 5Z"
            fill={hero ? "currentColor" : "var(--orange-soft)"}
          />
          <circle
            cx="24"
            cy="21"
            r="6"
            fill="var(--orange-display)"
          />
        </>
      )}
      {kind === "qr" && (
        <>
          <path
            d="M7 7h15v15H7zm19 0h15v15H26zM7 26h15v15H7z"
            fill="currentColor"
          />
          <path
            d="M12 12h5v5h-5zm19 0h5v5h-5zM12 31h5v5h-5z"
            fill="var(--benefit-cutout)"
          />
          <path
            d="M27 27h6v6h-6zm9 0h5v5h-5zm-9 9h5v5h-5zm9-1h5v6h-5z"
            fill="var(--orange-display)"
          />
        </>
      )}
    </svg>
  );
}

function Logo() {
  return (
    <a
      href="#inicio"
      className="logo"
      aria-label="Menúu, inicio"
    >
      <Image
        src="/images/menuu-logo.png"
        width={64}
        height={60}
        alt=""
      />
      <span className="brand-wordmark">
        Menú
        <span className="brand-last-letter">u</span>
      </span>
    </a>
  );
}

export default function Home() {
  const [step, setStep] = useState(0);
  const howCopy = useRef<HTMLDivElement>(null);
  const [howHeight, setHowHeight] = useState<number | null>(
    null
  );
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [editToken, setEditToken] = useState<string | null>(
    null
  );
  const [editingEmail, setEditingEmail] = useState(false);
  const [signupMethod, setSignupMethod] = useState<
    "google" | "email"
  >(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? "google" : "email"
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqPhotoHeight, setFaqPhotoHeight] = useState<
    number | null
  >(null);
  const [faqWaveGap, setFaqWaveGap] = useState(0);
  const faqSectionRef = useRef<HTMLElement>(null);
  const faqPhotoRef = useRef<HTMLElement>(null);
  const lastFaqRef = useRef<HTMLDivElement>(null);
  const [pointerEntered, setPointerEntered] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }

    return false;
  });
  const pointerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    | "idle"
    | "loading"
    | "success"
    | "already_registered"
    | "error"
  >("idle");
  const [error, setError] = useState("");
  const privacy = useRef<HTMLDialogElement>(null);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const signupPanelRef = useRef<HTMLDivElement>(null);
  const consentInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const panel = signupPanelRef.current;
    const form = panel?.querySelector("form");

    if (!panel) return;

    if (!form) {
      panel.style.minHeight = "";

      return;
    }

    const syncHeight = () => {
      const styles = getComputedStyle(panel);
      const verticalSpace =
        parseFloat(styles.paddingTop) +
        parseFloat(styles.paddingBottom) +
        parseFloat(styles.borderTopWidth) +
        parseFloat(styles.borderBottomWidth);

      panel.style.minHeight = `${Math.ceil(form.getBoundingClientRect().height + verticalSpace)}px`;
    };

    const observer = new ResizeObserver(syncHeight);

    observer.observe(form);
    window.addEventListener("resize", syncHeight);
    syncHeight();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [status]);

  const initGoogle = () => {
    if (typeof window === "undefined") return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.warn(
        "[Menúu] NEXT_PUBLIC_GOOGLE_CLIENT_ID no está definido. Revisa tus variables de entorno (en Vercel marca 'Preview' y vuelve a desplegar)."
      );

      return;
    }

    if (!window.google?.accounts?.id) return;

    if (!googleBtnContainerRef.current) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setStatus("loading");
          setError("");
          try {
            const res = await fetch(
              "/api/inscripciones/google",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  credential: response.credential,
                }),
              }
            );
            const data = (await res.json()) as {
              error?: string;
              ok?: boolean;
              alreadyRegistered?: boolean;
              email?: string;
            };

            if (!res.ok) {
              throw new Error(
                data.error ||
                  "No pudimos completar tu inscripción con Google."
              );
            }

            if (data.email) {
              setEmail(data.email);
              setRegisteredEmail(data.email);
            }
            setEditToken(null);
            setEditingEmail(false);

            if (data.alreadyRegistered) {
              setStatus("already_registered");
            } else {
              setStatus("success");
            }
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Error al conectar con Google."
            );
            setStatus("error");
          }
        },
        hd: "utec.edu.pe",
      });

      googleBtnContainerRef.current.innerHTML = "";
      const containerWidth = Math.min(
        320,
        Math.floor(googleBtnContainerRef.current.clientWidth)
      );

      window.google.accounts.id.renderButton(
        googleBtnContainerRef.current,
        {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: containerWidth,
          logo_alignment: "left",
          locale: "es",
        }
      );
    } catch (e) {
      console.error(
        "[Menúu] Error al inicializar Google Sign-In:",
        e
      );
    }
  };

  useEffect(() => {
    if (status !== "idle" || signupMethod !== "google") return;

    // Intentar inicializar de inmediato si ya cargó
    if (
      window.google?.accounts?.id &&
      googleBtnContainerRef.current
    ) {
      initGoogle();

      return;
    }

    // Polling de respaldo por si el script cargó antes o después de la hidratación
    const interval = setInterval(() => {
      if (
        window.google?.accounts?.id &&
        googleBtnContainerRef.current
      ) {
        initGoogle();
        clearInterval(interval);
      }
    }, 150);

    const timeout = setTimeout(
      () => clearInterval(interval),
      5000
    );

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, signupMethod]);

  useEffect(() => {
    const element = howCopy.current;

    if (!element) return;
    const measure = () =>
      setHowHeight(
        Math.ceil(element.getBoundingClientRect().height)
      );

    measure();
    const observer = new ResizeObserver(measure);

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const elements =
      document.querySelectorAll<HTMLElement>(".scroll-reveal");

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches ||
      !("IntersectionObserver" in window)
    ) {
      elements.forEach((element) =>
        element.classList.add("is-visible")
      );

      return;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }),
      {
        threshold: 0.08,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = pointerRef.current;

    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPointerEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;

      if (window.innerWidth <= 768) {
        setFaqPhotoHeight(null);

        return;
      }
      const section = faqSectionRef.current;
      const photo = faqPhotoRef.current;
      const lastQuestion = lastFaqRef.current;

      if (!section || !photo || !lastQuestion) return;
      const topWithinSection = (element: HTMLElement) => {
        let top = 0;
        let current: HTMLElement | null = element;

        while (current && current !== section) {
          top += current.offsetTop;
          current = current.offsetParent as HTMLElement | null;
        }

        return current === section ? top : null;
      };
      const photoTop = topWithinSection(photo);
      const lastTop = topWithinSection(lastQuestion);

      if (photoTop === null || lastTop === null) return;
      const expandedAnswerHeight =
        lastQuestion.querySelector<HTMLElement>(
          ".faq-answer-inner"
        )?.scrollHeight ?? 0;
      // Remove the height of whichever answer is currently animating. The photo
      // must keep the same target height as questions open and close.
      const visibleAnswerHeight = Array.from(
        section.querySelectorAll<HTMLElement>(".faq-answer")
      ).reduce(
        (total, answer) => total + answer.offsetHeight,
        0
      );
      const height =
        lastTop +
        lastQuestion.offsetHeight -
        visibleAnswerHeight +
        expandedAnswerHeight -
        photoTop;

      if (height > 0) setFaqPhotoHeight(Math.round(height));
    };
    const frame = requestAnimationFrame(measure);
    const settleTimer = window.setTimeout(measure, 800);

    window.addEventListener("resize", measure);
    void document.fonts.ready.then(measure);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const measure = () => {
      if (
        openFaq === null ||
        openFaq === faqs.length - 1 ||
        window.innerWidth <= 768 ||
        !faqPhotoRef.current ||
        !lastFaqRef.current
      ) {
        setFaqWaveGap(0);

        return;
      }
      const gap = Math.round(
        faqPhotoRef.current.getBoundingClientRect().bottom -
          lastFaqRef.current.getBoundingClientRect().bottom
      );

      setFaqWaveGap(gap >= 14 ? gap : 0);
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);

    faqSectionRef.current
      ?.querySelectorAll(".faq-item")
      .forEach((item) => observer.observe(item));
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [openFaq]);
  const current = steps[step];
  const Icon = current.icon;

  function navigateFromHeader(
    event: ReactMouseEvent<HTMLElement>
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !window.matchMedia("(min-width: 1001px)").matches
    )
      return;
    const anchor =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
        : null;
    const id = anchor?.hash.slice(1);

    if (
      !id ||
      !["por-que", "como-funciona", "lanzamiento"].includes(id)
    )
      return;
    const target = document.getElementById(id);

    if (!target) return;
    const content =
      id === "por-que"
        ? [
            target,
            target.parentElement?.querySelector<HTMLElement>(
              ".benefits"
            ),
          ].filter(
            (element): element is HTMLElement => !!element
          )
        : [target];
    const bounds = content.map((element) =>
      element.getBoundingClientRect()
    );
    const top =
      Math.min(...bounds.map((bound) => bound.top)) +
      window.scrollY;
    const bottom =
      Math.max(...bounds.map((bound) => bound.bottom)) +
      window.scrollY;
    const headerHeight =
      event.currentTarget.getBoundingClientRect().height;
    const availableHeight = window.innerHeight - headerHeight;
    const fits = bottom - top <= availableHeight;
    const scrollTop = fits
      ? top -
        headerHeight -
        (availableHeight - (bottom - top)) / 2
      : target.getBoundingClientRect().top + window.scrollY - 76;

    event.preventDefault();

    if (window.location.hash !== anchor?.hash)
      window.history.pushState(null, "", anchor?.hash);

    if (fits) {
      const maxScroll =
        document.documentElement.scrollHeight -
        window.innerHeight;

      if (scrollTop > maxScroll) {
        const currentTail =
          parseFloat(
            document.body.style.getPropertyValue(
              "--header-scroll-tail"
            )
          ) || 0;

        // The footer's entrance moves 12px upward, shortening the page as it appears.
        document.body.style.setProperty(
          "--header-scroll-tail",
          `${currentTail + Math.ceil(scrollTop - maxScroll) + 16}px`
        );
      }
    }
    window.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
        ? "instant"
        : "smooth",
    });
  }

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (status === "loading") return;

    if (!consent) {
      setConsentError(true);
      consentInput.current?.focus();
      setError("");
      setStatus("idle");

      return;
    }
    setConsentError(false);

    if (!/^[^\s@]+@utec\.edu\.pe$/i.test(email.trim())) {
      setError("Usa tu correo institucional @utec.edu.pe.");
      setEmailInvalid(true);
      emailInput.current?.focus();
      setStatus("error");

      return;
    }
    setEmailInvalid(false);
    const form = new FormData(e.currentTarget);

    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/inscripciones", {
        method: editingEmail ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          consent,
          website: form.get("website"),
          originalEmail: registeredEmail,
          editToken,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        ok?: boolean;
        editToken?: string | null;
        alreadyRegistered?: boolean;
      };

      if (!response.ok)
        throw new Error(
          data.error ||
            "No pudimos guardar tu correo. Inténtalo de nuevo."
        );

      if (data.alreadyRegistered) {
        setStatus("already_registered");
      } else {
        setStatus("success");
      }
      setRegisteredEmail(email.trim().toLowerCase());
      setEditToken(data.editToken ?? null);
      setEditingEmail(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Revisa tu conexión e inténtalo de nuevo."
      );
      setStatus("error");
    }
  }

  return (
    <>
      <header className="nav" onClick={navigateFromHeader}>
        <div className="container nav-inner">
          <Logo />
          <nav aria-label="Navegación principal">
            <a href="#por-que">Por qué Menúu</a>
            <a href="#como-funciona">Cómo funciona</a>
          </nav>
          <a className="button button-small" href="#lanzamiento">
            Únete a la lista <ArrowUpRight size={17} />
          </a>
        </div>
      </header>
      <main>
        <section className="hero container" id="inicio">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> PRÓXIMAMENTE EN UTEC
            </div>
            <h1>
              La U está difícil.
              <br /> Almorzar{" "}
              <span className="highlight">
                ya no.
                <svg
                  viewBox="0 0 420 20"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M4 13 Q190 -2 415 11" />
                </svg>
              </span>
            </h1>
            <p className="hero-lead">
              Comida de pequeños emprendimientos, directo al
              comedor de UTEC.{" "}
              <strong>Recibes tu pedido y pagas con QR.</strong>
            </p>
            <div className="hero-actions">
              <a href="#lanzamiento" className="button">
                Únete a la lista de espera{" "}
                <ArrowUpRight size={20} />
              </a>
              <a href="#como-funciona" className="text-link">
                Mira cómo funciona <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-note">
              <span className="hero-note-item">
                <Check size={15} /> Sin pago anticipado
              </span>
              <span
                className="hero-note-separator"
                aria-hidden="true"
              >
                ·
              </span>
              <span className="hero-note-item">
                Hecho para tu break
              </span>
            </div>
          </div>
          <div className="hero-art">
            <div className="art-orbit" />
            <div className="dish-photo">
              <Image
                src="/images/tallarines-verdes.webp"
                alt="Tallarines verdes peruanos con bistec en un envase plástico descartable; imagen referencial"
                width={600}
                height={400}
                priority
              />
              <span className="photo-label">
                TALLARINES VERDES · IMAGEN REFERENCIAL
              </span>
            </div>
            <span className="sticker">
              <span className="sticker-content">
                <span>menos vueltas</span>
                <strong>más ñam.</strong>
                <svg
                  className="tasty-mouth"
                  viewBox="0 0 44 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 4.5C10 17.5 34 17.5 41 4.5"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 13.5c2.4.6 5.6.6 8 0v3.2c0 2.7-1.8 4.6-4 4.6s-4-1.9-4-4.6z"
                    fill="#FB6418"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 17.3v2.2"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </span>
            <div className="floating location">
              <span className="float-icon">
                <BenefitIcon kind="location" hero />
              </span>
              <div>
                <small>Nos encontramos en</small>
                <strong>Comedor de UTEC</strong>
              </div>
            </div>
            <div className="floating payment">
              <span className="float-icon">
                <BenefitIcon kind="qr" hero />
              </span>
              <div>
                <strong>Tu pedido llegó.</strong>
                <small>
                  Ahora sí, paga con QR <Check size={12} />
                </small>
              </div>
            </div>
            <span className="side-note">
              el break se respeta ↗
            </span>
          </div>
        </section>
        <div className="ticker scroll-reveal">
          <div className="container ticker-inner">
            <span>
              <Utensils size={20} /> Pequeños emprendimientos
            </span>
            <i>✳</i>
            <span>
              <MapPin size={20} /> Un punto de encuentro
            </span>
            <i>✳</i>
            <span>
              <QrCode size={20} /> QR al recibir
            </span>
            <i>✳</i>
            <span>
              <strong className="ticker-number">100%</strong>{" "}
              pensado para la U
            </span>
          </div>
        </div>
        <section className="section container why scroll-reveal">
          <div className="section-top" id="por-que">
            <div>
              <span className="eyebrow">
                TU BREAK MERECE MÁS
              </span>
              <h2>
                Barato, cerca y listo.
                <br />{" "}
                <span className="muted">
                  Con un extra de sabor.
                </span>
              </h2>
            </div>
            <p>
              Elige tu menú favorito de pequeños emprendimientos
              y recógelo en el comedor de UTEC. Así de fácil:
              comida rica, sin salir a buscar y con más tiempo
              para ti.
            </p>
          </div>
          <div className="benefits">
            <article>
              <span className="benefit-icon" aria-hidden="true">
                <BenefitIcon kind="store" />
              </span>
              <h3>
                Pequeños negocios.
                <br /> Grandes antojos.
              </h3>
              <p>
                Descubre propuestas de emprendimientos que
                quieren llegar a tu universidad.
              </p>
            </article>
            <article>
              <span className="benefit-icon" aria-hidden="true">
                <BenefitIcon kind="location" />
              </span>
              <h3>
                Tu comida y tú.
                <br /> En el mismo lugar.
              </h3>
              <p>
                Entrega en el comedor de UTEC. Un punto de
                encuentro que ya es parte de tu día.
              </p>
            </article>
            <article>
              <span className="benefit-icon" aria-hidden="true">
                <BenefitIcon kind="qr" />
              </span>
              <h3>
                Pagas cuando
                <br /> la tienes contigo.
              </h3>
              <p>
                Escanea el QR al recibir tu pedido. Sin tener que
                pagar por adelantado.
              </p>
            </article>
          </div>
        </section>
        <section className="how scroll-reveal">
          <div className="container how-grid" id="como-funciona">
            <div className="how-copy" ref={howCopy}>
              <span className="eyebrow light">
                ASÍ DE SIMPLE
              </span>
              <div className="how-heading">
                <h2>
                  Tres pasos.
                  <br /> Un buen break.
                </h2>
                <span
                  className="how-tongue-badge"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 44 24"
                    fill="none"
                    focusable="false"
                  >
                    <g transform="translate(0 3)">
                      <path
                        d="M3 4.5C10 17.5 34 17.5 41 4.5"
                        stroke="currentColor"
                        strokeWidth="3.3"
                        strokeLinecap="round"
                      />
                      <g transform="translate(0 1.5)">
                        <path
                          d="M16.5 13c3.3 1.2 7.7 1.2 11 0v5c0 3.7-2.3 5.8-5.5 5.8s-5.5-2.1-5.5-5.8z"
                          fill="#FB6418"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M22 18v4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </g>
                    </g>
                  </svg>
                </span>
              </div>
              <p className="how-intro">
                Conoce cómo será tu pedido con Menúu, desde el
                primer antojo hasta la entrega.
              </p>
              <div
                className="step-tabs"
                role="tablist"
                aria-label="Pasos del pedido"
              >
                {steps.map((item, i) => (
                  <button
                    key={item.name}
                    role="tab"
                    id={`step-${i}`}
                    aria-selected={step === i}
                    aria-controls="step-panel"
                    onClick={() => setStep(i)}
                    className={step === i ? "selected" : ""}
                  >
                    <span>0{i + 1}</span>
                    {item.name}
                    <ArrowUpRight size={20} />
                  </button>
                ))}
              </div>
            </div>
            <div
              className="demo-frame"
              style={{
                height: howHeight ? `${howHeight}px` : undefined,
              }}
            >
              <div
                className="demo"
                role="tabpanel"
                id="step-panel"
                aria-labelledby={`step-${step}`}
              >
                <div
                  className={`demo-visual demo-visual-step-${step}`}
                  style={{
                    backgroundImage: `url("${current.image}")`,
                  }}
                  key={`visual-${step}`}
                >
                  <Image
                    src={current.image}
                    alt={current.alt}
                    width={500}
                    height={350}
                  />
                  <span className="demo-step">
                    <Icon size={16} strokeWidth={1.8} />{" "}
                    {current.tag}
                  </span>
                  {current.imageNote && (
                    <span className="demo-image-note">
                      {current.imageNote}
                    </span>
                  )}
                </div>
                <div
                  className="demo-footer"
                  key={`footer-${step}`}
                >
                  <div className="demo-summary">
                    <h3>{current.title}</h3>
                    <p>{current.description}</p>
                  </div>
                  {step < 2 ? (
                    <button
                      className="button demo-button"
                      onClick={() => setStep(step + 1)}
                    >
                      Siguiente paso <ArrowRight size={18} />
                    </button>
                  ) : (
                    <a
                      className="button demo-button"
                      href="#lanzamiento"
                    >
                      Únete a la lista <ArrowUpRight size={18} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section
          ref={faqSectionRef}
          className="section container questions scroll-reveal"
        >
          <div className="questions-intro">
            <span className="eyebrow">
              SIN QUEDARTE CON LA DUDA
            </span>
            <h2>
              Antes del
              <br /> primer bocado.
            </h2>
            <p>
              Menúu está en preparación.
              <br /> Esto es lo que necesitas saber.
            </p>
            <figure
              ref={faqPhotoRef}
              className="questions-photo"
              style={
                faqPhotoHeight
                  ? { height: faqPhotoHeight }
                  : undefined
              }
            >
              <Image
                src="/images/faq-preparacion-descartable.png"
                alt="Manos cerrando un envase y una tapa de plástico descartable con un almuerzo casero"
                width={1456}
                height={1080}
                loading="lazy"
              />
              <figcaption>Imagen referencial</figcaption>
            </figure>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a], index) => (
              <div
                ref={
                  index === faqs.length - 1
                    ? lastFaqRef
                    : undefined
                }
                className={`faq-item${openFaq === index ? " is-open" : ""}`}
                key={q}
              >
                <button
                  type="button"
                  id={`faq-question-${index}`}
                  aria-expanded={openFaq === index}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() =>
                    setOpenFaq((current) =>
                      current === index ? null : index
                    )
                  }
                >
                  {q}
                  <Plus size={20} aria-hidden="true" />
                </button>
                <div
                  className="faq-answer"
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-question-${index}`}
                  aria-hidden={openFaq !== index}
                >
                  <div className="faq-answer-inner">
                    <p>{a}</p>
                  </div>
                </div>
              </div>
            ))}
            <div
              className={`faq-gap-wave${faqWaveGap > 0 ? " is-visible" : ""}`}
              style={{ height: faqWaveGap }}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 1000 18"
                preserveAspectRatio="none"
                fill="none"
                focusable="false"
              >
                <path
                  d="M2 12 Q85 4 168 12 T334 12 T500 12 T666 12 T832 12 T998 12"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div
              ref={pointerRef}
              className={`faq-pointer${pointerEntered ? " is-visible" : ""}${openFaq === null ? "" : " is-hidden"}`}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 180 92"
                preserveAspectRatio="none"
                fill="none"
              >
                <path
                  d="M5 76C53 91 112 64 160 13"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M136 17c7-2 17-4 24-4-1 9-1 17-4 24"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="faq-pointer-label">
                <span>preguntas</span>
                <span>frecuentes</span>
              </span>
            </div>
          </div>
        </section>
        <section className="signup-wrap scroll-reveal">
          <div className="container signup" id="lanzamiento">
            <div className="signup-copy">
              <span className="eyebrow">
                <span className="live-dot" /> LISTA DE ESPERA ·
                UTEC
              </span>
              <h2>
                Que tu próximo
                <br /> break tenga{" "}
                <em className="brand-wordmark">
                  Menú<span>u</span>
                </em>
              </h2>
              <p>
                Déjanos tu correo y te avisaremos cuando lancemos
                Menúu. Tú pones el antojo.
              </p>
              <span className="signup-note">
                <ShoppingBag size={18} /> Primero en UTEC.
                Pronto, en tu break.
              </span>
            </div>
            <div className="signup-panel" ref={signupPanelRef}>
              {status === "already_registered" ? (
                <div
                  className="success already-registered"
                  role="status"
                >
                  <span className="success-mark">
                    <Check size={30} aria-hidden="true" />
                  </span>
                  <h3>¡Ya estás en la lista!</h3>
                  <p>
                    {email ? (
                      <>
                        El correo <strong>{email}</strong> ya
                        está registrado para el lanzamiento en
                        UTEC.
                      </>
                    ) : (
                      "Tu correo ya está registrado para el lanzamiento en UTEC."
                    )}
                  </p>
                  <small>
                    Te avisaremos apenas Menúu esté disponible.
                    Tu lugar está asegurado.
                  </small>
                  <button
                    type="button"
                    className="success-reset-btn"
                    onClick={() => {
                      setStatus("idle");
                      setEmail("");
                      setRegisteredEmail("");
                      setEditToken(null);
                    }}
                  >
                    Inscribir otro correo
                  </button>
                </div>
              ) : status === "success" ? (
                <div className="success" role="status">
                  <span className="success-mark">
                    <Check size={30} />
                  </span>
                  <h3>Tu antojo ya tiene lugar.</h3>
                  <p>
                    Guardamos <strong>{registeredEmail}</strong>.
                    Te avisaremos cuando lancemos Menúu en UTEC.
                  </p>
                  <small>
                    Esto es una inscripción a la lista de espera,
                    no un pedido.
                  </small>
                  {editToken ? (
                    <button
                      className="success-return"
                      type="button"
                      onClick={() => {
                        setStatus("idle");
                        setEditingEmail(true);
                        setSignupMethod("email");
                        setEmail(registeredEmail);
                        setError("");
                        setEmailInvalid(false);
                        setConsentError(false);
                        requestAnimationFrame(() =>
                          emailInput.current?.focus()
                        );
                      }}
                    >
                      Editar mi correo registrado{" "}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      className="success-return"
                      type="button"
                      onClick={() => {
                        setStatus("idle");
                        setEditingEmail(false);
                        setEmail("");
                        setRegisteredEmail("");
                        setEditToken(null);
                        setConsent(false);
                        setError("");
                        setEmailInvalid(false);
                        setConsentError(false);
                      }}
                    >
                      Escribir otro correo{" "}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <h3>
                    {editingEmail
                      ? "Corrige tu correo"
                      : "Entérate del lanzamiento"}
                  </h3>
                  <p>Un correo para avisarte. Cero vueltas.</p>
                  <div className="signup-method-stage">
                    {!editingEmail &&
                      process.env
                        .NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                        <div
                          className="signup-method-surface google-sso-wrapper"
                          aria-hidden={signupMethod !== "google"}
                          inert={signupMethod !== "google"}
                        >
                          <div className="google-cloud">
                            <svg
                              className="google-cloud-outline"
                              viewBox="0 0 500 200"
                              preserveAspectRatio="none"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path d="M52 39C62 19 91 16 110 27C126 8 158 7 179 23C198 10 224 12 239 25C259 8 291 8 309 25C333 10 365 15 376 35C403 24 433 34 441 56C468 58 482 79 468 99C484 119 470 140 444 142C435 166 404 177 380 165C361 186 326 187 306 170C284 189 250 190 230 173C204 187 171 184 154 167C129 182 94 176 80 156C52 160 28 144 29 123C9 109 11 83 32 69C27 56 35 44 52 39Z" />
                            </svg>
                            <span className="signup-method-label">
                              Regístrate con Google
                            </span>
                            <div
                              ref={googleBtnContainerRef}
                              className="google-btn-container"
                            />
                            <small>
                              Con tu cuenta institucional
                              @utec.edu.pe.
                            </small>
                          </div>
                        </div>
                      )}
                    <div
                      className="signup-method-surface email-signup"
                      aria-hidden={
                        signupMethod !== "email" && !editingEmail
                      }
                      inert={
                        signupMethod !== "email" && !editingEmail
                      }
                    >
                      <label
                        className="signup-method-label"
                        htmlFor="email"
                      >
                        Tu correo institucional
                      </label>
                      <div
                        className={`email-field${emailInvalid ? " is-invalid" : ""}`}
                      >
                        <Mail size={18} />
                        <input
                          ref={emailInput}
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="tu@utec.edu.pe"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailInvalid(false);
                            setError("");
                          }}
                          maxLength={254}
                          pattern="[a-zA-Z0-9._%+-]+@utec[.]edu[.]pe"
                          title="Usa tu correo institucional @utec.edu.pe"
                          required
                          aria-invalid={
                            emailInvalid || undefined
                          }
                          aria-describedby={
                            emailInvalid
                              ? "email-error"
                              : undefined
                          }
                        />
                      </div>
                      <div
                        className="honeypot"
                        aria-hidden="true"
                      >
                        <label htmlFor="website">
                          Sitio web
                        </label>
                        <input
                          id="website"
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                        />
                      </div>
                      <label className="consent">
                        <input
                          ref={consentInput}
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => {
                            setConsent(e.target.checked);

                            if (e.target.checked)
                              setConsentError(false);
                          }}
                          aria-invalid={
                            consentError || undefined
                          }
                          aria-describedby={
                            consentError
                              ? "consent-error"
                              : undefined
                          }
                        />
                        <span>
                          Acepto que Menúu me avise por correo
                          del lanzamiento en UTEC.{" "}
                          <button
                            type="button"
                            onClick={() =>
                              privacy.current?.showModal()
                            }
                          >
                            Ver privacidad
                          </button>
                        </span>
                      </label>
                      <button
                        className="button signup-button"
                        type="submit"
                        disabled={status === "loading"}
                      >
                        {status === "loading"
                          ? "Guardando tu correo…"
                          : editingEmail
                            ? "Guardar cambio"
                            : "Quiero estar en la lista"}
                        <ArrowUpRight size={20} />
                      </button>
                    </div>
                  </div>
                  {!editingEmail &&
                    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                      <button
                        type="button"
                        className="signup-alternative"
                        disabled={status === "loading"}
                        onClick={() => {
                          setSignupMethod(
                            signupMethod === "google"
                              ? "email"
                              : "google"
                          );
                          setStatus("idle");
                          setError("");
                          setEmailInvalid(false);
                          setConsentError(false);
                        }}
                      >
                        {signupMethod === "google" ? (
                          <Mail size={18} aria-hidden="true" />
                        ) : (
                          <svg
                            className="google-g-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M18.1 7.2a7 7 0 1 0 1 5.1H12" />
                            <path d="M19.1 12.3v4" />
                          </svg>
                        )}
                        {signupMethod === "google"
                          ? "Prefiero escribir mi correo"
                          : "Prefiero usar Google"}
                        <ArrowRight
                          size={17}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer scroll-reveal">
        <div className="container footer-inner">
          <a
            className="footer-brand"
            href="#inicio"
            aria-label="Menúu, volver al inicio"
          >
            <Image
              src="/images/menuu-logo.png"
              width={37}
              height={35}
              alt=""
            />
            <span>
              Menú
              <span className="brand-last-letter">u</span>
            </span>
          </a>
          <p>Tu antojo tiene punto de encuentro.</p>
          <button
            type="button"
            onClick={() => privacy.current?.showModal()}
          >
            Política de privacidad
          </button>
        </div>
      </footer>
      {(consentError || error) && (
        <aside
          className="consent-toast"
          id={consentError ? "consent-error" : "email-error"}
          role="alert"
        >
          <CircleAlert size={22} aria-hidden="true" />
          <span>
            {consentError
              ? "Marca la casilla para aceptar el aviso antes de registrarte."
              : error}
          </span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => {
              setConsentError(false);
              setError("");
            }}
          >
            <X size={18} />
          </button>
        </aside>
      )}
      <dialog ref={privacy} className="privacy-dialog">
        <button
          className="close-dialog"
          aria-label="Cerrar aviso de privacidad"
          onClick={() => privacy.current?.close()}
        >
          <X />
        </button>
        <span className="eyebrow">TUS DATOS</span>
        <h2>Tu correo, para el lanzamiento.</h2>
        <p>
          Menúu guarda tu correo, la fecha de inscripción y tu
          aceptación de este aviso para avisarte del lanzamiento
          de Menúu en UTEC.
        </p>
        <p>
          El registro no es un pedido ni un pago. No solicitamos
          datos bancarios. La lista de correos no es pública.
        </p>
        <p>
          Puedes retirar tu interés respondiendo al correo que
          recibas y solicitar que eliminemos tu inscripción. No
          usaremos este registro para campañas de terceros.
        </p>
        <p className="privacy-version">Aviso de privacidad</p>
        <button
          className="button"
          onClick={() => privacy.current?.close()}
        >
          Entendido <Check size={18} />
        </button>
      </dialog>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initGoogle}
      />
    </>
  );
}
