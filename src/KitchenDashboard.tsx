import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "./components/ui";
import { CustomizationDialog } from "./components/CustomizationDialog";
import {
  BrandAddIcon,
  BrandCalendarIcon,
  BrandCameraIcon,
  BrandDeleteIcon,
  BrandDishIcon,
  BrandLogoutIcon,
  BrandOrdersIcon,
  BrandStatsIcon,
} from "./components/BrandIcons";
import {
  dateLabel,
  money,
  timeLabel,
  weekDate,
  type CustomizationGroup,
  type User,
} from "./data/catalog";
import "./kitchen.css";

type Dish = {
  id: string;
  name: string;
  description: string;
  priceSoles: number;
  imageUrl: string;
  imageAlt: string;
  active: boolean;
  customization: CustomizationGroup[];
};
type Offer = {
  id: string;
  dishId: string;
  date: string;
  deliveryTime: string;
  pickupUntil: string;
  bookingDeadline: string;
  capacity: number;
  reservedCount: number;
  descriptionOverride: string | null;
  priceSoles: number | null;
  hasCustomizationOverride: boolean;
  customization: CustomizationGroup[];
  publishedAt: string | null;
  soldOutAt: string | null;
};
type KitchenReservation = {
  offerId: string;
  orderId: string;
  code: string;
  studentName: string;
  studentEmail: string;
  quantity: number;
  status: string;
  fulfillmentStatus: "pending" | "delivered" | "no_show";
  pickupConfirmed: boolean;
  paymentRecorded: string | null;
  createdAt: string;
  manualAdded: boolean;
};
type StatOffer = {
  id: string;
  dishId: string;
  dishName: string;
  date: string;
  capacity: number;
  reservedCount: number;
  publishedAt: string | null;
  soldOutAt: string | null;
  units: number;
  revenueCents: number;
  orderCount: number;
  firstBookingAt: string | null;
};
type Data = {
  profile: {
    id: string;
    name: string;
    description: string;
    logoUrl: string;
    imageUrl: string;
  };
  dishes: Dish[];
  offers: Offer[];
  reservations: KitchenReservation[];
  analytics: {
    offers: StatOffer[];
    bookingHours: { hour: number; units: number }[];
    bookingTimeline: { offerId: string; hour: string; units: number }[];
    totalOrders: number;
  };
};
export type KitchenSection =
  "inicio" | "menu" | "platos" | "estadisticas" | "cuenta";
const todayLima = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const localDateTime = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const p = (kind: string) =>
    parts.find((part) => part.type === kind)?.value || "";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
};
const isoFromLocal = (value: string) =>
  new Date(`${value}:00-05:00`).toISOString();
const blankDish = (): Dish => ({
  id: "",
  name: "",
  description: "",
  priceSoles: 0,
  imageUrl: "",
  imageAlt: "",
  active: true,
  customization: [],
});
const blankOffer = (dishId = ""): Offer => {
  const today = todayLima();
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  let date =
    nowTime >= "12:59"
      ? new Date(Date.parse(`${today}T12:00:00Z`) + 86400000)
          .toISOString()
          .slice(0, 10)
      : today;
  if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0)
    date = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);
  return {
    id: "",
    dishId,
    date,
    deliveryTime: "13:00",
    pickupUntil: "13:10",
    bookingDeadline: `${date}T12:59`,
    capacity: 10,
    reservedCount: 0,
    descriptionOverride: null,
    priceSoles: null,
    hasCustomizationOverride: false,
    customization: [],
    publishedAt: null,
    soldOutAt: null,
  };
};
const cloneGroups = (groups: CustomizationGroup[]) =>
  JSON.parse(JSON.stringify(groups)) as CustomizationGroup[];
const duration = (start: string | null, end: string) => {
  if (!start) return "Sin fecha histórica";
  const minutes = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  );
  if (minutes < 0) return "Sin fecha histórica";
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(result.error || "No pudimos guardar los cambios.");
  return result;
}
async function upload(file: File, scope: "profile" | "dish") {
  if (!["image/png", "image/jpeg"].includes(file.type))
    throw new Error("Elige una foto PNG o JPG.");
  const response = await fetch(
    `/api/kitchen/photo${scope === "dish" ? "?scope=dish" : ""}`,
    { method: "POST", headers: { "Content-Type": file.type }, body: file },
  );
  const result = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !result.url)
    throw new Error(result.error || "No pudimos subir la foto.");
  return result.url;
}

function KitchenSelect({
  id,
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (open)
      optionRefs.current[
        Math.max(
          0,
          options.findIndex((option) => option.value === value),
        )
      ]?.focus();
  }, [open, options, value]);
  const focusOption = (index: number) =>
    optionRefs.current[(index + options.length) % options.length]?.focus();
  const selected = options.find((option) => option.value === value);
  return (
    <div
      className="km-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <span id={`${id}-label`} className="km-select-label">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="km-select-trigger"
        role="combobox"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-controls={`${id}-options`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          } else if (event.key === "Escape") setOpen(false);
        }}
      >
        <span id={`${id}-value`} className={selected ? "" : "placeholder"}>
          {selected?.label || placeholder || "Selecciona una opción"}
        </span>
        <ChevronDown size={19} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="km-select-options"
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  focusOption(index + 1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  focusOption(index - 1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  focusOption(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  focusOption(options.length - 1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  triggerRef.current?.focus();
                }
              }}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaginatedList<T>({
  items,
  id,
  noun,
  render,
}: {
  items: T[];
  id: string;
  noun: string;
  render: (visible: T[]) => ReactNode;
}) {
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  return (
    <div className="km-paged-list">
      {render(items.slice(start, start + pageSize))}
      <nav className="km-pagination" aria-label={`Páginas de ${noun}`}>
        <div className="km-page-size">
          <KitchenSelect
            id={`${id}-size`}
            label="Por página"
            value={String(pageSize)}
            options={[5, 10, 20].map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            onChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          />
        </div>
        <span className="km-page-summary" aria-live="polite">
          {start + 1}–{Math.min(start + pageSize, items.length)} de{" "}
          {items.length} {noun}
        </span>
        <div className="km-page-buttons">
          <button
            type="button"
            disabled={currentPage === 1}
            aria-label={`Página anterior de ${noun}`}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={19} />
          </button>
          <span>
            Página {currentPage} de {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount}
            aria-label={`Página siguiente de ${noun}`}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </nav>
    </div>
  );
}

function KitchenOfferPreview({
  offer,
  dish,
  kind,
}: {
  offer: Offer;
  dish?: Dish;
  kind: "published" | "reserved";
}) {
  const available = Math.max(0, offer.capacity - offer.reservedCount);
  return (
    <article className="km-upcoming-card">
      <img
        src={dish?.imageUrl || "/images/menuu-logo.png"}
        alt={dish?.imageAlt || dish?.name || "Plato publicado"}
      />
      <div className="km-upcoming-copy">
        <strong>{dish?.name || "Plato"}</strong>
        <span>
          {dateLabel(offer.date, {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}{" "}
          · {timeLabel(offer.deliveryTime)}
        </span>
        <div
          className="km-occupancy"
          role="img"
          aria-label={`${offer.reservedCount} de ${offer.capacity} porciones reservadas`}
        >
          <i
            style={{
              width: `${Math.min(100, (offer.reservedCount / offer.capacity) * 100)}%`,
            }}
          />
        </div>
        <small>
          {kind === "published"
            ? `${offer.reservedCount} de ${offer.capacity} reservadas · ${available} sin reservar`
            : `${offer.reservedCount} de ${offer.capacity} porciones reservadas`}
        </small>
      </div>
    </article>
  );
}

function KitchenHome({ data, today }: { data: Data; today: string }) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const upcoming = data.offers
    .filter(
      (offer) =>
        offer.date > today ||
        (offer.date === today && offer.pickupUntil >= time),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.deliveryTime.localeCompare(b.deliveryTime),
    );
  const reserved = upcoming.filter((offer) => offer.reservedCount > 0);
  const reservedCount = upcoming.reduce(
    (sum, offer) => sum + offer.reservedCount,
    0,
  );
  const unreserved = upcoming.reduce(
    (sum, offer) => sum + offer.capacity - offer.reservedCount,
    0,
  );
  const dish = (offer: Offer) =>
    data.dishes.find((item) => item.id === offer.dishId);
  return (
    <div className="km-home">
      <div className="km-metrics km-home-metrics">
        <div>
          <BrandCalendarIcon size={24} />
          <span>Menús próximos</span>
          <strong>{upcoming.length}</strong>
          <small>Hasta el fin de la siguiente semana</small>
        </div>
        <div>
          <BrandOrdersIcon size={24} />
          <span>Porciones reservadas</span>
          <strong>{reservedCount}</strong>
          <small>Para los próximos recojos</small>
        </div>
        <div>
          <BrandDishIcon size={24} />
          <span>Porciones sin reserva</span>
          <strong>{unreserved}</strong>
          <small>Capacidad aún no reservada</small>
        </div>
      </div>
      <div className="km-home-grid">
        <section className="km-panel">
          <span className="eyebrow">LO QUE VIENE</span>
          <h2>Menú publicado</h2>
          <p className="km-panel-intro">
            La barra muestra qué parte de cada menú ya está reservada.
          </p>
          {upcoming.length ? (
            <PaginatedList
              items={upcoming}
              id="published"
              noun="menús"
              render={(visible) => (
                <div className="km-upcoming-list">
                  {visible.map((offer) => (
                    <KitchenOfferPreview
                      key={offer.id}
                      offer={offer}
                      dish={dish(offer)}
                      kind="published"
                    />
                  ))}
                </div>
              )}
            />
          ) : (
            <p>Aún no hay menús para próximos recojos.</p>
          )}
          <a className="km-panel-link" href="#cocina/menu">
            Gestionar menús <ArrowRight size={17} />
          </a>
        </section>
        <section className="km-panel">
          <span className="eyebrow">POR PREPARAR</span>
          <h2>Reservas próximas</h2>
          <p className="km-panel-intro">
            Porciones confirmadas para cada recojo.
          </p>
          {reserved.length ? (
            <PaginatedList
              items={reserved}
              id="reserved"
              noun="menús con reservas"
              render={(visible) => (
                <div className="km-upcoming-list">
                  {visible.map((offer) => (
                    <KitchenOfferPreview
                      key={offer.id}
                      offer={offer}
                      dish={dish(offer)}
                      kind="reserved"
                    />
                  ))}
                </div>
              )}
            />
          ) : (
            <p>Aún no hay reservas para los próximos recojos.</p>
          )}
          <a className="km-panel-link" href="#cocina/estadisticas">
            Analizar reservas <ArrowRight size={17} />
          </a>
        </section>
      </div>
    </div>
  );
}

function KitchenDishCard({
  item,
  onEdit,
  onPreview,
}: {
  item: Dish;
  onEdit: () => void;
  onPreview: () => void;
}) {
  return (
    <article className="km-dish-card">
      <img src={item.imageUrl} alt={item.imageAlt || item.name} />
      <div className="km-dish-card-body">
        <div className="km-dish-card-top">
          <span
            className={`km-dish-status${item.active ? "" : " km-dish-status-off"}`}
          >
            {item.active ? "Disponible para menús" : "Archivado"}
          </span>
          <strong>{money(item.priceSoles)}</strong>
        </div>
        <h2>{item.name}</h2>
        <p>{item.description || "Sin descripción"}</p>
        <div className="km-dish-card-foot">
          <span>
            <BrandDishIcon size={18} />{" "}
            {item.customization.length
              ? `${item.customization.length} ${item.customization.length === 1 ? "grupo de opciones" : "grupos de opciones"}`
              : "Sin personalización"}
          </span>
          <div className="km-dish-card-actions">
            <Button variant="quiet" onClick={onPreview}>
              Vista previa
            </Button>
            <Button variant="secondary" onClick={onEdit}>
              Editar
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function KitchenDishPreview({
  dish,
  kitchen,
  onClose,
}: {
  dish: Dish;
  kitchen: Data["profile"];
  onClose: () => void;
}) {
  return (
    <CustomizationDialog
      preview
      offer={{ ...dish, kitchenName: kitchen.name }}
      onClose={onClose}
    />
  );
}

function KitchenMenuRow({
  offer,
  dish,
  today,
  onEdit,
  onReservations,
  reservationsOpen,
}: {
  offer: Offer;
  dish?: Dish;
  today: string;
  onEdit: () => void;
  onReservations: () => void;
  reservationsOpen: boolean;
}) {
  const past = offer.date < today;
  return (
    <article className="km-menu-row">
      <div className="km-menu-date">
        <strong>
          {dateLabel(offer.date, { weekday: "short", day: "numeric" })}
        </strong>
        <small>
          {timeLabel(offer.deliveryTime)}–{timeLabel(offer.pickupUntil)}
        </small>
      </div>
      <img
        className="km-menu-photo"
        src={dish?.imageUrl || "/images/menuu-logo.png"}
        alt={dish?.imageAlt || dish?.name || "Plato"}
      />
      <div className="km-menu-info">
        <h2>{dish?.name || "Plato"}</h2>
        <p>
          Reserva hasta{" "}
          {new Intl.DateTimeFormat("es-PE", {
            timeZone: "America/Lima",
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(offer.bookingDeadline))}
        </p>
      </div>
      <div className="km-menu-count">
        <strong>
          {offer.reservedCount} de {offer.capacity}
        </strong>
        <small>porciones reservadas</small>
      </div>
      <div className="km-menu-action">
        {past ? (
          <span className="km-locked">Día pasado</span>
        ) : (
          <Button variant="secondary" onClick={onEdit}>
            Editar
          </Button>
        )}
        <Button
          variant="quiet"
          onClick={onReservations}
          aria-expanded={reservationsOpen}
        >
          Reservas
        </Button>
      </div>
    </article>
  );
}

function KitchenReservationPanel({
  offer,
  reservations,
  onChanged,
  onClose,
}: {
  offer: Offer;
  reservations: KitchenReservation[];
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [busyOrder, setBusyOrder] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoadingStudents(true);
      try {
        const result = await request<{ students: typeof students }>(
          `/api/kitchen/offers/${offer.id}/students?q=${encodeURIComponent(search)}`,
        );
        if (active) setStudents(result.students);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos buscar estudiantes.",
          );
      } finally {
        if (active) setLoadingStudents(false);
      }
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [offer.id, search, reservations]);
  async function change(path: string, payload: unknown, key: string) {
    setBusyOrder(key);
    setError("");
    try {
      await request(path, payload);
      await onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar la reserva.",
      );
    } finally {
      setBusyOrder("");
    }
  }
  const pickupEndTime = new Date(
    `${offer.date}T${offer.pickupUntil}:00-05:00`,
  ).getTime();
  const pickupEnded = Date.now() >= pickupEndTime;
  const canAdd = offer.reservedCount < offer.capacity;
  return (
    <section className="km-reservations" aria-label="Gestión de reservas">
      <div className="km-reservations-head">
        <div>
          <span className="eyebrow">RESERVAS DEL MENÚ</span>
          <h2>
            {dateLabel(offer.date, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <p>
            {reservations.length} pedidos · {offer.reservedCount} de{" "}
            {offer.capacity} porciones
          </p>
        </div>
        <button
          className="km-icon-button"
          type="button"
          onClick={onClose}
          aria-label="Cerrar reservas"
        >
          <X size={20} />
        </button>
      </div>
      {error && (
        <p className="km-reservations-error" role="alert">
          {error}
        </p>
      )}
      {reservations.length ? (
        <div className="km-reservation-list">
          {reservations.map((item) => {
            const state =
              item.fulfillmentStatus === "delivered"
                ? "Entregado"
                : item.fulfillmentStatus === "no_show"
                  ? "Cancelado · no vino"
                  : item.pickupConfirmed
                    ? "Sin entregar · confirmó asistencia"
                    : "Pendiente de confirmar";
            return (
              <article className="km-reservation" key={item.orderId}>
                <div className="km-reservation-person">
                  <strong>{item.studentName}</strong>
                  <span>{item.studentEmail}</span>
                  <small>
                    {item.quantity}{" "}
                    {item.quantity === 1 ? "porción" : "porciones"} ·{" "}
                    {item.code}
                  </small>
                  <small>
                    {item.manualAdded ? "Alta manual" : "Reservada"} ·{" "}
                    {new Intl.DateTimeFormat("es-PE", {
                      timeZone: "America/Lima",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                      .format(new Date(item.createdAt))
                      .replace(/([ap])\.\s*m\./gi, "$1.m.")}
                  </small>
                </div>
                <div className="km-reservation-manage">
                  <span className="km-reservation-state">{state}</span>
                  <div className="km-reservation-actions">
                    {item.fulfillmentStatus === "pending" &&
                      !item.pickupConfirmed && (
                        <Button
                          variant="secondary"
                          disabled={!!busyOrder}
                          onClick={() =>
                            change(
                              "/api/kitchen/reservations/update",
                              { orderId: item.orderId, action: "confirm" },
                              item.orderId,
                            )
                          }
                        >
                          Confirmó asistencia
                        </Button>
                      )}
                    {item.fulfillmentStatus !== "delivered" &&
                      item.fulfillmentStatus !== "no_show" && (
                        <Button
                          variant="secondary"
                          disabled={!!busyOrder}
                          onClick={() =>
                            change(
                              "/api/kitchen/reservations/update",
                              { orderId: item.orderId, action: "deliver" },
                              item.orderId,
                            )
                          }
                        >
                          Entregado
                        </Button>
                      )}
                    {item.fulfillmentStatus === "pending" &&
                      !item.pickupConfirmed &&
                      pickupEnded &&
                      new Date(item.createdAt).getTime() <= pickupEndTime && (
                        <Button
                          variant="quiet"
                          disabled={!!busyOrder}
                          onClick={() =>
                            change(
                              "/api/kitchen/reservations/update",
                              { orderId: item.orderId, action: "cancel" },
                              item.orderId,
                            )
                          }
                        >
                          No vino · cancelar
                        </Button>
                      )}
                    {(item.fulfillmentStatus !== "pending" ||
                      item.pickupConfirmed) && (
                      <Button
                        variant="quiet"
                        disabled={!!busyOrder}
                        onClick={() =>
                          change(
                            "/api/kitchen/reservations/update",
                            { orderId: item.orderId, action: "reset" },
                            item.orderId,
                          )
                        }
                      >
                        Corregir estado
                      </Button>
                    )}
                  </div>
                </div>
                <KitchenSelect
                  id={`payment-${item.orderId}`}
                  label="Pago efectuado"
                  value={item.paymentRecorded || ""}
                  placeholder="Sin registrar"
                  options={["QR", "Efectivo", "Transferencia", "Otro"].map(
                    (value) => ({ value, label: value }),
                  )}
                  onChange={(paymentMethod) =>
                    change(
                      "/api/kitchen/reservations/update",
                      {
                        orderId: item.orderId,
                        action: "payment",
                        paymentMethod,
                      },
                      item.orderId,
                    )
                  }
                />
              </article>
            );
          })}
        </div>
      ) : (
        <p className="km-empty">Aún no hay reservas en este menú.</p>
      )}
      <div className="km-reservation-add">
        <div>
          <h3>Añadir estudiante</h3>
          <p>
            Solo aparecen cuentas sin reserva en este menú. Se añade una porción
            y se descuenta del cupo. También puedes registrar una reserva
            extraordinaria después de la hora; quedará anotada su fecha y hora.
          </p>
        </div>
        {canAdd ? (
          <>
            <label>
              Buscar por nombre o correo
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre o correo UTEC"
              />
            </label>
            <div className="km-candidate-list" aria-live="polite">
              {loadingStudents ? (
                <p>Buscando estudiantes…</p>
              ) : students.length ? (
                students.map((student) => (
                  <div key={student.id}>
                    <span>
                      <strong>{student.name}</strong>
                      <small>{student.email}</small>
                    </span>
                    <Button
                      variant="secondary"
                      disabled={!!busyOrder}
                      onClick={() =>
                        change(
                          "/api/kitchen/reservations/add",
                          {
                            offerId: offer.id,
                            studentId: student.id,
                            quantity: 1,
                          },
                          student.id,
                        )
                      }
                    >
                      Añadir
                    </Button>
                  </div>
                ))
              ) : (
                <p>No hay estudiantes disponibles con esa búsqueda.</p>
              )}
            </div>
          </>
        ) : (
          <p className="km-hint">
            No se pueden añadir más reservas: el cupo se agotó.
          </p>
        )}
      </div>
    </section>
  );
}

function DishRankingChart({ offers }: { offers: StatOffer[] }) {
  const totals = new Map<string, { name: string; units: number }>();
  for (const offer of offers) {
    const entry = totals.get(offer.dishId) || {
      name: offer.dishName,
      units: 0,
    };
    entry.units += offer.units;
    totals.set(offer.dishId, entry);
  }
  const ranked = [...totals.values()]
    .filter((item) => item.units > 0)
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);
  const max = ranked[0]?.units || 1;
  return (
    <article className="km-panel">
      <span className="eyebrow">PLATOS POPULARES</span>
      <h2>Más reservados</h2>
      <p className="km-panel-intro">
        Porciones reservadas por plato durante los últimos 28 días.
      </p>
      {ranked.length ? (
        <div className="km-ranking">
          {ranked.map((item, index) => (
            <div key={item.name}>
              <div>
                <strong>
                  {index + 1}. {item.name}
                </strong>
                <span>
                  {item.units} {item.units === 1 ? "porción" : "porciones"}
                </span>
              </div>
              <div className="km-ranking-track">
                <i style={{ width: `${(item.units / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>Los platos aparecerán aquí tras la primera reserva.</p>
      )}
    </article>
  );
}

function OptionEditor({
  groups,
  onChange,
  quickCutlery = false,
}: {
  groups: CustomizationGroup[];
  onChange: (groups: CustomizationGroup[]) => void;
  quickCutlery?: boolean;
}) {
  const update = (index: number, patch: Partial<CustomizationGroup>) =>
    onChange(
      groups.map((group, i) => (i === index ? { ...group, ...patch } : group)),
    );
  const hasCutlery = groups.some(
    (group) =>
      group.title.trim().toLocaleLowerCase("es") === "¿deseas cubiertos?",
  );
  return (
    <fieldset className="km-options">
      <legend>Personalización</legend>
      <p>Estas opciones aparecerán al confirmar el plato.</p>
      {quickCutlery && (
        <div className="km-cutlery-shortcut">
          <span>
            <strong>Atajo: cubiertos</strong>
            <small>Añade una elección Sí/No sin costo extra.</small>
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={hasCutlery || groups.length >= 8}
            onClick={() =>
              onChange([
                ...groups,
                {
                  id: crypto.randomUUID(),
                  title: "¿Deseas cubiertos?",
                  selectionType: "single",
                  required: true,
                  maxSelections: 1,
                  choices: [
                    {
                      id: crypto.randomUUID(),
                      label: "Sí, con cubiertos",
                      priceSoles: 0,
                    },
                    {
                      id: crypto.randomUUID(),
                      label: "No, sin cubiertos",
                      priceSoles: 0,
                    },
                  ],
                },
              ])
            }
          >
            {hasCutlery ? "Añadido" : "Añadir cubiertos"}
          </Button>
        </div>
      )}
      {groups.map((group, index) => (
        <div className="km-option-group" key={group.id}>
          <div className="km-option-top">
            <strong>Grupo {index + 1}</strong>
            <button
              type="button"
              className="km-text-button"
              onClick={() => onChange(groups.filter((_, i) => i !== index))}
              aria-label={`Quitar grupo ${index + 1}`}
            >
              <BrandDeleteIcon size={17} /> Quitar
            </button>
          </div>
          <label>
            <span className="km-field-label">
              Nombre del grupo{" "}
              <span className="km-required" aria-label="obligatorio">
                *
              </span>
            </span>
            <input
              value={group.title}
              maxLength={60}
              required
              onChange={(event) => update(index, { title: event.target.value })}
              placeholder="Por ejemplo, acompañamiento"
            />
          </label>
          <div className="km-option-settings">
            <KitchenSelect
              id={`group-${group.id}-type`}
              label="Tipo de elección"
              value={group.selectionType || "single"}
              options={[
                { value: "single", label: "Una opción" },
                { value: "multiple", label: "Varias opciones" },
              ]}
              onChange={(value) =>
                update(index, {
                  selectionType: value as "single" | "multiple",
                  maxSelections: value === "single" ? 1 : null,
                })
              }
            />
            <label>
              Límite de elecciones
              <input
                type="number"
                min={1}
                max={16}
                disabled={group.selectionType !== "multiple"}
                value={
                  group.selectionType !== "multiple"
                    ? 1
                    : (group.maxSelections ?? "")
                }
                placeholder="Sin límite"
                onChange={(event) =>
                  update(index, {
                    maxSelections: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label className="km-check">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(event) =>
                  update(index, { required: event.target.checked })
                }
              />{" "}
              Obligatorio
            </label>
          </div>
          <div className="km-choice-list">
            {group.choices.map((choice, choiceIndex) => (
              <div className="km-choice" key={choice.id}>
                <label>
                  <span className="km-field-label">
                    Opción{" "}
                    <span className="km-required" aria-label="obligatorio">
                      *
                    </span>
                  </span>
                  <input
                    value={choice.label}
                    maxLength={60}
                    required
                    onChange={(event) =>
                      update(index, {
                        choices: group.choices.map((item, i) =>
                          i === choiceIndex
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      })
                    }
                    placeholder="Ej. Con ensalada"
                  />
                </label>
                <label>
                  Extra S/
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={choice.priceSoles || ""}
                    onChange={(event) =>
                      update(index, {
                        choices: group.choices.map((item, i) =>
                          i === choiceIndex
                            ? {
                                ...item,
                                priceSoles: Number(event.target.value),
                              }
                            : item,
                        ),
                      })
                    }
                    placeholder="0.00"
                  />
                </label>
                <button
                  type="button"
                  className="km-icon-button"
                  disabled={group.choices.length <= 2}
                  aria-label="Quitar opción"
                  onClick={() =>
                    update(index, {
                      choices: group.choices.filter(
                        (_, i) => i !== choiceIndex,
                      ),
                    })
                  }
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="km-text-button"
            disabled={group.choices.length >= 16}
            onClick={() =>
              update(index, {
                choices: [
                  ...group.choices,
                  { id: crypto.randomUUID(), label: "", priceSoles: 0 },
                ],
              })
            }
          >
            <BrandAddIcon size={17} /> Añadir opción
          </button>
        </div>
      ))}
      <button
        type="button"
        className="km-outline-button"
        disabled={groups.length >= 8}
        onClick={() =>
          onChange([
            ...groups,
            {
              id: crypto.randomUUID(),
              title: "",
              selectionType: "single",
              required: false,
              maxSelections: 1,
              choices: [
                { id: crypto.randomUUID(), label: "", priceSoles: 0 },
                { id: crypto.randomUUID(), label: "", priceSoles: 0 },
              ],
            },
          ])
        }
      >
        <BrandAddIcon size={18} /> Añadir grupo
      </button>
    </fieldset>
  );
}

function KitchenProfile({
  user,
  profile,
  onSaved,
  onLogout,
}: {
  user: User;
  profile: Data["profile"];
  onSaved: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    setName(profile.name);
    setDescription(profile.description);
  }, [profile.name, profile.description]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request("/api/kitchen/profile", { name, description });
      await onSaved();
      setEditing(false);
      setSuccess("Datos de la cocina actualizados.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos guardar los cambios.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changePhoto(file?: File) {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    setSuccess("");
    try {
      await upload(file, "profile");
      await onSaved();
      setSuccess("Foto actualizada.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos subir la foto.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  return (
    <div className="account-panel km-profile">
      <div className="account-intro">
        <div>
          <span className="eyebrow">CORREO DE ACCESO</span>
          <p>{user.email}</p>
        </div>
        <Button variant="quiet" onClick={onLogout}>
          <BrandLogoutIcon size={18} /> Cerrar sesión
        </Button>
      </div>
      {success && (
        <p className="account-success" role="status">
          <Check size={18} aria-hidden="true" /> {success}
        </p>
      )}
      {error && (
        <p className="form-error km-profile-error" role="alert">
          {error}
        </p>
      )}
      <div className="km-profile-layout">
        <div className="km-profile-photo">
          <img
            src={profile.logoUrl || "/images/menuu-logo.png"}
            alt={`Foto de ${profile.name}`}
          />
          <label className="km-outline-button">
            <BrandCameraIcon size={18} />
            {photoBusy ? "Subiendo…" : "Cambiar foto"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={photoBusy}
              onChange={(event) => changePhoto(event.target.files?.[0])}
            />
          </label>
          <small>PNG o JPG · máximo 2 MB</small>
        </div>
        {editing ? (
          <form className="account-form km-profile-form" onSubmit={save}>
            <label>
              <span className="km-field-label">
                Nombre de la cocina{" "}
                <small className="km-profile-limit">{name.length}/40</small>
              </span>
              <input
                value={name}
                required
                minLength={2}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Descripción
              <textarea
                value={description}
                maxLength={70}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
              />
              <small className="km-description-count">
                {description.length}/70 caracteres
              </small>
            </label>
            <div className="account-form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setName(profile.name);
                  setDescription(profile.description);
                  setEditing(false);
                  setError("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  busy ||
                  (name.trim() === profile.name &&
                    description.trim() === profile.description)
                }
              >
                {busy ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="account-details km-profile-details">
            <div className="account-detail">
              <dt>Nombre de la cocina</dt>
              <dd>{profile.name}</dd>
            </div>
            <div className="account-detail">
              <dt>Descripción</dt>
              <dd>{profile.description || "Sin descripción"}</dd>
            </div>
            <div className="account-form-actions">
              <Button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setSuccess("");
                }}
              >
                Editar
              </Button>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}

function KitchenStats({ data }: { data: Data }) {
  const recent = data.analytics.offers;
  const sold = recent.reduce((sum, item) => sum + item.units, 0);
  const revenue =
    recent.reduce((sum, item) => sum + item.revenueCents, 0) / 100;
  const fastest = [...recent]
    .filter((item) => item.soldOutAt && item.publishedAt)
    .sort(
      (a, b) =>
        new Date(a.soldOutAt!).getTime() -
        new Date(a.publishedAt!).getTime() -
        (new Date(b.soldOutAt!).getTime() - new Date(b.publishedAt!).getTime()),
    )
    .slice(0, 3);
  const hourMax = Math.max(
    1,
    ...data.analytics.bookingHours.map((item) => item.units),
  );
  const timelineOffers = recent.filter((item) =>
    data.analytics.bookingTimeline.some((row) => row.offerId === item.id),
  );
  return (
    <div className="km-analytics">
      <div className="km-metrics km-home-metrics">
        <div>
          <BrandDishIcon size={24} />
          <span>Porciones reservadas</span>
          <strong>{sold}</strong>
          <small>Últimos 28 días</small>
        </div>
        <div>
          <BrandOrdersIcon size={24} />
          <span>Pedidos</span>
          <strong>{data.analytics.totalOrders}</strong>
          <small>Últimos 28 días</small>
        </div>
        <div>
          <BrandStatsIcon size={24} />
          <span>Valor reservado</span>
          <strong>{money(revenue)}</strong>
          <small>Últimos 28 días · pago al recojo</small>
        </div>
      </div>
      <div className="km-home-grid">
        <article className="km-panel">
          <span className="eyebrow">CUÁNDO RESERVAN</span>
          <h2>Horas de reserva</h2>
          <p className="km-panel-intro">
            Porciones reservadas según la hora en Lima durante los últimos 28
            días.
          </p>
          {data.analytics.bookingHours.length ? (
            <div className="km-bars">
              {data.analytics.bookingHours.map((item) => (
                <div key={item.hour}>
                  <span>{String(item.hour).padStart(2, "0")}:00</span>
                  <div>
                    <i style={{ width: `${(100 * item.units) / hourMax}%` }} />
                  </div>
                  <strong>{item.units}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p>Aún no hay reservas para mostrar horarios.</p>
          )}
        </article>
        <DishRankingChart offers={recent} />
      </div>
      <article className="km-panel km-fastest">
        <span className="eyebrow">SE AGOTARON ANTES</span>
        <h2>Los más rápidos</h2>
        <p className="km-panel-intro">
          Tiempo desde la publicación hasta agotar las porciones.
        </p>
        {fastest.length ? (
          fastest.map((item) => (
            <div className="km-mini-row" key={item.id}>
              <span>
                {item.dishName}
                <small>{dateLabel(item.date)}</small>
              </span>
              <strong>{duration(item.publishedAt, item.soldOutAt!)}</strong>
            </div>
          ))
        ) : (
          <p>Cuando una oferta agote sus porciones, aparecerá aquí.</p>
        )}
      </article>
      <article className="km-panel">
        <span className="eyebrow">POR OFERTA</span>
        <h2>Ritmo de cada menú</h2>
        <p className="km-panel-intro">
          Tiempo desde la publicación hasta la primera reserva y el agotamiento.
        </p>
        {recent.length ? (
          <PaginatedList
            items={recent}
            id="stats-offers"
            noun="menús"
            render={(visible) => (
              <div className="km-stat-table">
                <div className="km-stat-head">
                  <span>Plato y día</span>
                  <span>Publicación → primera reserva</span>
                  <span>Agotó stock</span>
                  <span>Reservas</span>
                </div>
                {visible.map((item) => (
                  <div key={item.id}>
                    <span>
                      <strong>{item.dishName}</strong>
                      <small>
                        {dateLabel(item.date, {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                    </span>
                    <span>
                      {item.firstBookingAt
                        ? duration(item.publishedAt, item.firstBookingAt)
                        : "Sin reservas"}
                    </span>
                    <span>
                      {item.soldOutAt
                        ? duration(item.publishedAt, item.soldOutAt)
                        : item.reservedCount >= item.capacity
                          ? "Sin marca histórica"
                          : "No se agotó"}
                    </span>
                    <span>
                      {item.units}/{item.capacity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          />
        ) : (
          <p>Aún no hay ofertas para analizar.</p>
        )}
      </article>
      <article className="km-panel">
        <span className="eyebrow">DETALLE DE RESERVAS</span>
        <h2>Reservas por hora y menú</h2>
        <p className="km-panel-intro">
          Abre un menú para ver a qué hora llegaron sus reservas.
        </p>
        {timelineOffers.length ? (
          <PaginatedList
            items={timelineOffers}
            id="stats-timeline"
            noun="menús con reservas"
            render={(visible) => (
              <div className="km-timeline">
                {visible.map((item) => (
                  <details key={item.id}>
                    <summary>
                      <strong>{item.dishName}</strong>
                      <span>
                        Publicado:{" "}
                        {item.publishedAt
                          ? localDateTime(item.publishedAt).replace("T", " · ")
                          : "Sin fecha histórica"}
                      </span>
                    </summary>
                    <div>
                      {data.analytics.bookingTimeline
                        .filter((row) => row.offerId === item.id)
                        .map((row) => (
                          <span key={row.hour}>
                            {row.hour} · {row.units}{" "}
                            {row.units === 1 ? "porción" : "porciones"}
                          </span>
                        ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          />
        ) : (
          <p>Aún no hay reservas por hora para mostrar.</p>
        )}
        <small className="km-footnote">
          Se cuentan reservas confirmadas. El tiempo hasta agotar stock se
          registra desde ahora para cada oferta nueva.
        </small>
      </article>
    </div>
  );
}

export default function KitchenDashboard({
  section,
  user,
  onLogout,
  onChanged,
}: {
  section: KitchenSection;
  user: User;
  onLogout: () => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dish, setDish] = useState<Dish | null>(null);
  const [dishStep, setDishStep] = useState<1 | 2>(1);
  const [previewDish, setPreviewDish] = useState<Dish | null>(null);
  const [createdDish, setCreatedDish] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [reservationsOfferId, setReservationsOfferId] = useState<string | null>(
    null,
  );
  const [week, setWeek] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const refresh = async () => {
    setError("");
    const next = await request<Data>("/api/kitchen/data");
    setData(next);
    await onChanged();
  };
  useEffect(() => {
    refresh().catch((cause) =>
      setError(
        cause instanceof Error ? cause.message : "No pudimos cargar tu cocina.",
      ),
    );
  }, [user.kitchenId]);
  const save = async (path: string, payload: unknown, done: () => void) => {
    setBusy(true);
    setError("");
    try {
      await request(path, payload);
      await refresh();
      done();
      setNotice("Cambios guardados.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  };
  const changeDishImage = async (file?: File) => {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      const url = await upload(file, "dish");
      setDish(
        (current) =>
          current && {
            ...current,
            imageUrl: url,
            imageAlt: current.imageAlt || current.name,
          },
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos subir la foto.",
      );
    } finally {
      setPhotoBusy(false);
    }
  };
  const current = todayLima();
  const day = new Date(`${current}T12:00:00Z`);
  const monday = new Date(day);
  monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const next = new Date(monday);
  next.setUTCDate(monday.getUTCDate() + 7);
  const weeks = [
    monday.toISOString().slice(0, 10),
    next.toISOString().slice(0, 10),
  ];
  const visibleOffers =
    data?.offers.filter(
      (item) =>
        item.date >= weeks[week] && item.date < weekDate(weeks[week], 7),
    ) || [];
  const showError = error && (
    <div className="km-alert" role="alert">
      {error}
      <button
        type="button"
        onClick={() => setError("")}
        aria-label="Cerrar error"
      >
        <X size={18} />
      </button>
    </div>
  );
  return (
    <section className="km-shell">
      <div className="km-heading">
        <span className="eyebrow">ESPACIO DE COCINAS</span>
        <h1>
          {section === "inicio"
            ? `Hola, ${data?.profile.name || "cocina"}`
            : {
                menu: "Menús semanales",
                platos: "Mis platos",
                estadisticas: "Estadísticas",
                cuenta: "Mi cocina",
              }[section]}
        </h1>
        <p>
          {section === "inicio"
            ? "Organiza los próximos recojos y las porciones por preparar."
            : section === "menu"
              ? "Publica platos creados para esta semana y la siguiente."
              : section === "platos"
                ? "Prepara tu catálogo antes de añadirlo a un menú."
                : section === "estadisticas"
                  ? "Analiza las reservas de los últimos 28 días y descubre cuándo se llenan tus menús."
                  : "Actualiza los datos visibles de tu cocina."}
        </p>
      </div>
      {showError}
      {notice && (
        <div className="km-success" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Cerrar mensaje"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {previewDish && data && (
        <KitchenDishPreview
          dish={previewDish}
          kitchen={data.profile}
          onClose={() => setPreviewDish(null)}
        />
      )}
      {!data ? (
        error ? (
          <div className="km-load-fallback">
            <p>No pudimos mostrar los datos de tu cocina.</p>
            <div>
              <Button
                type="button"
                onClick={() =>
                  refresh().catch((cause) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "No pudimos cargar tu cocina.",
                    ),
                  )
                }
              >
                Reintentar
              </Button>
              <Button type="button" variant="secondary" onClick={onLogout}>
                <BrandLogoutIcon size={18} /> Cerrar sesión
              </Button>
            </div>
          </div>
        ) : (
          <p className="km-loading" role="status">
            Cargando tu cocina…
          </p>
        )
      ) : (
        <>
          {section === "inicio" && <KitchenHome data={data} today={current} />}
          {section === "cuenta" && (
            <KitchenProfile
              user={user}
              profile={data.profile}
              onSaved={refresh}
              onLogout={onLogout}
            />
          )}
          {section === "platos" && (
            <div className="km-workspace">
              <div className="km-list-head">
                <p>{data.dishes.length} platos creados</p>
                <Button
                  onClick={() => {
                    setDish(blankDish());
                    setDishStep(1);
                    setOffer(null);
                    setCreatedDish(false);
                  }}
                >
                  <BrandAddIcon size={18} inverse /> Nuevo plato
                </Button>
              </div>
              <div
                className={`km-dish-guide${dish && !dish.id ? " km-dish-guide-creating" : ""}${createdDish ? " km-dish-guide-published" : ""}`}
                aria-label="Pasos para publicar un plato"
              >
                <div
                  className={dish && dishStep === 1 ? "km-guide-current" : ""}
                >
                  <BrandDishIcon size={24} />
                  <span>
                    <strong>1. Crea el plato</strong>
                    <small>Foto, descripción y precio base</small>
                  </span>
                </div>
                <div
                  className={dish && dishStep === 2 ? "km-guide-current" : ""}
                >
                  <BrandAddIcon size={24} />
                  <span>
                    <strong>2. Define opciones</strong>
                    <small>Si permites personalizarlo</small>
                  </span>
                </div>
                <div className={createdDish ? "km-guide-current" : ""}>
                  <BrandCalendarIcon size={24} />
                  <span>
                    <strong>3. Publícalo</strong>
                    <small>
                      {createdDish ? (
                        <a href="#cocina/menu">Ir a Menús →</a>
                      ) : (
                        "Elige el día en Menús"
                      )}
                    </small>
                  </span>
                </div>
              </div>
              {dish && (
                <form
                  className="km-editor"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    if (dishStep === 1) {
                      if (dish.imageUrl) setDishStep(2);
                      return;
                    }
                    const wasNew = !dish.id;
                    save("/api/kitchen/dishes", dish, () => {
                      setDish(null);
                      if (wasNew) setCreatedDish(true);
                    });
                  }}
                >
                  <div className="km-editor-head">
                    <div>
                      <span className="eyebrow">PASO {dishStep} DE 2</span>
                      <h2>
                        {dishStep === 1
                          ? dish.id
                            ? "Editar plato"
                            : "Nuevo plato"
                          : "Define las opciones"}
                      </h2>
                    </div>
                    <div className="km-editor-head-actions">
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() =>
                          setPreviewDish({
                            ...dish,
                            customization: cloneGroups(dish.customization),
                          })
                        }
                      >
                        Vista previa
                      </Button>
                      <button
                        type="button"
                        className="km-icon-button"
                        onClick={() => setDish(null)}
                        aria-label="Cerrar editor"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                  {dishStep === 1 ? (
                    <div className="km-form-grid">
                      <label>
                        <span className="km-field-label">
                          Nombre{" "}
                          <span
                            className="km-required"
                            aria-label="obligatorio"
                          >
                            *
                          </span>
                        </span>
                        <input
                          required
                          maxLength={80}
                          value={dish.name}
                          onChange={(event) =>
                            setDish({ ...dish, name: event.target.value })
                          }
                          placeholder="Ej. Ají de gallina"
                        />
                      </label>
                      <label>
                        <span className="km-field-label">
                          Precio base S/{" "}
                          <span
                            className="km-required"
                            aria-label="obligatorio"
                          >
                            *
                          </span>
                        </span>
                        <input
                          type="number"
                          required
                          min={0}
                          max={1000}
                          step="0.01"
                          value={
                            dish.priceSoles === 0 && !dish.id
                              ? ""
                              : dish.priceSoles
                          }
                          onChange={(event) =>
                            setDish({
                              ...dish,
                              priceSoles: Number(event.target.value),
                            })
                          }
                          placeholder="Ej. 11.00"
                        />
                      </label>
                      <label className="km-wide">
                        <span className="km-field-label">
                          Descripción{" "}
                          <small>Opcional · {dish.description.length}/90</small>
                        </span>
                        <textarea
                          maxLength={90}
                          rows={2}
                          value={dish.description}
                          onChange={(event) =>
                            setDish({
                              ...dish,
                              description: event.target.value,
                            })
                          }
                          placeholder="Cuenta qué lleva o si incluye postre o bebida"
                        />
                      </label>
                      <div className="km-wide km-photo-field">
                        <span>
                          Foto del plato{" "}
                          <span
                            className="km-required"
                            aria-label="obligatorio"
                          >
                            *
                          </span>
                        </span>
                        <label className="km-outline-button km-upload">
                          <BrandCameraIcon size={18} />
                          {photoBusy ? "Subiendo…" : "Subir foto"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            disabled={photoBusy}
                            onChange={(event) =>
                              changeDishImage(event.target.files?.[0])
                            }
                          />
                        </label>
                        <small>PNG o JPG · máximo 2 MB</small>
                        {dish.imageUrl && (
                          <img
                            className="km-dish-preview"
                            src={dish.imageUrl}
                            alt={dish.imageAlt || dish.name}
                          />
                        )}
                      </div>
                      <label className="km-wide">
                        <span className="km-field-label">
                          Texto alternativo de la foto{" "}
                          <small className="km-optional-tag">Opcional</small>
                        </span>
                        <input
                          value={dish.imageAlt}
                          maxLength={120}
                          onChange={(event) =>
                            setDish({ ...dish, imageAlt: event.target.value })
                          }
                          placeholder="Ej. Ají de gallina en envase descartable"
                        />
                      </label>
                      <label className="km-check km-wide">
                        <input
                          type="checkbox"
                          checked={dish.active}
                          onChange={(event) =>
                            setDish({ ...dish, active: event.target.checked })
                          }
                        />{" "}
                        Plato activo para futuros menús
                      </label>
                    </div>
                  ) : (
                    <>
                      <div className="km-dish-summary">
                        <img
                          src={dish.imageUrl}
                          alt={dish.imageAlt || dish.name}
                        />
                        <div>
                          <span className="eyebrow">DATOS DEL PLATO</span>
                          <h3>{dish.name}</h3>
                          <p>{dish.description || "Sin descripción"}</p>
                          <strong>{money(dish.priceSoles)}</strong>
                        </div>
                        <Button
                          type="button"
                          variant="quiet"
                          onClick={() => setDishStep(1)}
                        >
                          Editar datos
                        </Button>
                      </div>
                      <OptionEditor
                        groups={dish.customization}
                        onChange={(customization) =>
                          setDish({ ...dish, customization })
                        }
                        quickCutlery
                      />
                    </>
                  )}
                  <div className="km-form-actions km-dish-actions">
                    {dishStep === 1 && !dish.imageUrl && (
                      <p className="km-hint" role="status">
                        Sube una foto del plato para continuar.
                      </p>
                    )}
                    {dishStep === 2 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setDishStep(1)}
                      >
                        Volver
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setDish(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        busy || photoBusy || (dishStep === 1 && !dish.imageUrl)
                      }
                    >
                      {dishStep === 1
                        ? "Continuar a opciones"
                        : busy
                          ? "Guardando…"
                          : "Guardar plato"}
                    </Button>
                  </div>
                </form>
              )}
              {data.dishes.length ? (
                <div className="km-dish-list">
                  {data.dishes.map((item) => (
                    <KitchenDishCard
                      key={item.id}
                      item={item}
                      onPreview={() => setPreviewDish(item)}
                      onEdit={() => {
                        setDish({
                          ...item,
                          customization: cloneGroups(item.customization),
                        });
                        setDishStep(1);
                        setOffer(null);
                        setCreatedDish(false);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="km-empty">
                  Crea tu primer plato para añadirlo a un menú semanal.
                </div>
              )}
            </div>
          )}
          {section === "menu" && (
            <div className="km-workspace">
              <div className="km-week-controls">
                <div role="group" aria-label="Semana">
                  <button
                    type="button"
                    className={week === 0 ? "active" : ""}
                    onClick={() => setWeek(0)}
                  >
                    Esta semana
                  </button>
                  <button
                    type="button"
                    className={week === 1 ? "active" : ""}
                    onClick={() => setWeek(1)}
                  >
                    Siguiente semana
                  </button>
                </div>
                <span className="km-week-range" aria-live="polite">
                  {dateLabel(weeks[week], {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  –{" "}
                  {dateLabel(weekDate(weeks[week], 5), {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
                <Button
                  onClick={() => {
                    setOffer(
                      blankOffer(data.dishes.find((item) => item.active)?.id),
                    );
                    setDish(null);
                  }}
                  disabled={!data.dishes.some((item) => item.active)}
                >
                  <BrandAddIcon size={18} inverse /> Añadir menú
                </Button>
              </div>
              {!data.dishes.some((item) => item.active) && (
                <p className="km-hint">
                  Crea un plato activo antes de publicar un menú.
                </p>
              )}
              {offer && (
                <form
                  className="km-editor"
                  onSubmit={(event) => {
                    event.preventDefault();
                    save(
                      "/api/kitchen/offers",
                      {
                        ...offer,
                        bookingDeadline: isoFromLocal(offer.bookingDeadline),
                      },
                      () => setOffer(null),
                    );
                  }}
                >
                  <div className="km-editor-head">
                    <h2>{offer.id ? "Editar menú" : "Nuevo menú"}</h2>
                    <button
                      type="button"
                      className="km-icon-button"
                      onClick={() => setOffer(null)}
                      aria-label="Cerrar editor"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="km-form-grid">
                    <KitchenSelect
                      id="offer-dish"
                      label="Plato creado"
                      value={offer.dishId}
                      placeholder="Selecciona un plato"
                      options={data.dishes
                        .filter((item) => item.active)
                        .map((item) => ({ value: item.id, label: item.name }))}
                      onChange={(dishId) => setOffer({ ...offer, dishId })}
                    />
                    <label>
                      Fecha de recojo
                      <input
                        type="date"
                        required
                        min={current}
                        value={offer.date}
                        onChange={(event) =>
                          setOffer({ ...offer, date: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Hora de recojo
                      <input
                        type="time"
                        required
                        value={offer.deliveryTime}
                        onChange={(event) =>
                          setOffer({
                            ...offer,
                            deliveryTime: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Fin de recojo
                      <input
                        type="time"
                        required
                        value={offer.pickupUntil}
                        onChange={(event) =>
                          setOffer({
                            ...offer,
                            pickupUntil: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Cierre de reserva
                      <input
                        type="datetime-local"
                        required
                        value={offer.bookingDeadline}
                        onChange={(event) =>
                          setOffer({
                            ...offer,
                            bookingDeadline: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Porciones disponibles en total
                      <input
                        type="number"
                        required
                        min={Math.max(1, offer.reservedCount)}
                        max={10000}
                        value={offer.capacity}
                        onChange={(event) =>
                          setOffer({
                            ...offer,
                            capacity: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Precio especial S/ <small>Opcional</small>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        step="0.01"
                        value={offer.priceSoles ?? ""}
                        placeholder="Usar precio del plato"
                        onChange={(event) =>
                          setOffer({
                            ...offer,
                            priceSoles: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                      />
                    </label>
                    <label className="km-wide">
                      Descripción para este día{" "}
                      <small>
                        Opcional · {offer.descriptionOverride?.length || 0}/90
                      </small>
                      <textarea
                        maxLength={90}
                        rows={2}
                        value={offer.descriptionOverride ?? ""}
                        onChange={(event) =>
                          setOffer({
                            ...offer,
                            descriptionOverride: event.target.value || null,
                          })
                        }
                        placeholder="Si hoy el plato tiene un detalle distinto"
                      />
                    </label>
                  </div>
                  <label className="km-check">
                    <input
                      type="checkbox"
                      checked={offer.hasCustomizationOverride}
                      onChange={(event) =>
                        setOffer({
                          ...offer,
                          hasCustomizationOverride: event.target.checked,
                          customization: event.target.checked
                            ? cloneGroups(
                                data.dishes.find(
                                  (item) => item.id === offer.dishId,
                                )?.customization || [],
                              )
                            : [],
                        })
                      }
                    />{" "}
                    Usar opciones especiales para este menú
                  </label>
                  {offer.hasCustomizationOverride && (
                    <OptionEditor
                      groups={offer.customization}
                      onChange={(customization) =>
                        setOffer({ ...offer, customization })
                      }
                    />
                  )}
                  <div className="km-form-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOffer(null)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={busy}>
                      {busy ? "Guardando…" : "Guardar menú"}
                    </Button>
                  </div>
                </form>
              )}
              {visibleOffers.length ? (
                <div className="km-offer-list">
                  {visibleOffers.map((item) => (
                    <KitchenMenuRow
                      key={item.id}
                      offer={item}
                      dish={data.dishes.find((d) => d.id === item.dishId)}
                      today={current}
                      reservationsOpen={reservationsOfferId === item.id}
                      onReservations={() =>
                        setReservationsOfferId((current) =>
                          current === item.id ? null : item.id,
                        )
                      }
                      onEdit={() =>
                        setOffer({
                          ...item,
                          customization: cloneGroups(item.customization),
                          bookingDeadline: localDateTime(item.bookingDeadline),
                        })
                      }
                    />
                  ))}
                  {reservationsOfferId &&
                    data.offers.find(
                      (item) => item.id === reservationsOfferId,
                    ) && (
                      <KitchenReservationPanel
                        offer={data.offers.find(
                          (item) => item.id === reservationsOfferId,
                        )!}
                        reservations={data.reservations.filter(
                          (item) => item.offerId === reservationsOfferId,
                        )}
                        onChanged={refresh}
                        onClose={() => setReservationsOfferId(null)}
                      />
                    )}
                </div>
              ) : (
                <div className="km-empty">
                  No hay menús publicados para esta semana.
                </div>
              )}
            </div>
          )}
          {section === "estadisticas" && <KitchenStats data={data} />}
        </>
      )}
    </section>
  );
}
