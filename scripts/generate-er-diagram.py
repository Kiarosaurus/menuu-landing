"""Render the current libSQL schema as a compact, readable ER overview."""

from pathlib import Path
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, ConnectionPatch

CREAM = '#FFFAF2'
GREEN = '#075338'
INK = '#154832'
MUTED = '#52664F'
ORANGE = '#FB6418'
BORDER = '#D7DDCB'
WHITE = '#FFFFFF'

entities = {
    'kitchen_images': (.025, .90, 'Fotos de cocina', ['id  PK', 'kitchen_id  FK → kitchens', 'mime_type · content']),
    'kitchens': (.025, .76, 'Cocinas', ['id  PK', 'name · description', 'image_url · logo_url']),
    'users': (.025, .54, 'Usuarios', ['id  PK', 'email  UNIQUE · password_hash', 'role · kitchen_id  FK', 'student_code · career · birth_date']),
    'sessions': (.025, .36, 'Sesiones', ['token_hash  PK', 'user_id  FK → users', 'expires_at']),
    'booking_requests': (.025, .18, 'Solicitudes de reserva', ['user_id + request_key  PK', 'user_id  FK → users', 'payload_hash · response']),

    'dishes': (.22, .76, 'Platos base', ['kitchen_id + id  PK', 'kitchen_id  FK → kitchens', 'name · price_cents · active', 'description · image_url']),
    'option_groups': (.22, .50, 'Grupos de opciones', ['kitchen_id + dish_id + id  PK', 'plato  FK → dishes', 'selection_type · required', 'max_selections']),
    'option_choices': (.22, .23, 'Opciones de plato', ['cocina + plato + grupo + id  PK', 'grupo  FK → option_groups', 'label · price_cents']),

    'offers': (.415, .76, 'Menús publicados', ['id  PK', 'cocina + plato  FK → dishes', 'offer_date · horario · deadline', 'capacity · reserved_count', 'precio/opciones especiales']),
    'offer_option_groups': (.415, .50, 'Grupos del menú', ['offer_id + id  PK', 'offer_id  FK → offers', 'selection_type · required', 'max_selections']),
    'offer_option_choices': (.415, .23, 'Opciones del menú', ['offer_id + group_id + id  PK', 'grupo  FK → offer_option_groups', 'label · price_cents']),

    'orders': (.61, .76, 'Pedidos', ['id  PK · code  UNIQUE', 'user_id  FK → users', 'kitchen_id  FK → kitchens', 'fecha · estado · total', 'entrega · permiso de reseña']),
    'order_items': (.61, .50, 'Ítems del pedido', ['id  PK', 'order_id  FK → orders', 'offer_id  FK → offers', 'cantidad · precio · comentario']),
    'order_item_choices': (.61, .23, 'Opciones elegidas', ['item + grupo + opción  PK', 'order_item_id  FK → order_items', 'etiqueta · precio']),

    'order_reviews': (.805, .76, 'Reseñas de cocina', ['order_id  PK y FK → orders', 'kitchen_rating  1–5', 'created_at']),
    'order_item_reviews': (.805, .50, 'Reseñas de platos', ['order_item_id  PK', 'order_id  FK → order_reviews', 'ítem  FK → order_items', 'food_rating  1–5']),
    'schema_migrations': (.805, .23, 'Migraciones', ['name  PK', 'applied_at', 'Control técnico del esquema']),
}

width = .17
height = .145
fig, ax = plt.subplots(figsize=(25, 15), dpi=180)
fig.patch.set_facecolor(CREAM)
ax.set_facecolor(CREAM)
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis('off')

ax.text(.025, .985, 'Menúu · consumidores', color=GREEN, fontsize=26, weight='bold', va='top')
ax.text(.975, .984, 'Diagrama entidad relación  ·  Turso / libSQL', color=MUTED, fontsize=12, ha='right', va='top')
ax.text(.025, .949, '16 tablas de producto + 1 tabla de migraciones', color=INK, fontsize=13, va='top')

def anchor(name, side):
    x, top, _, _ = entities[name]
    if side == 'left': return x, top - height / 2
    if side == 'right': return x + width, top - height / 2
    if side == 'top': return x + width / 2, top
    return x + width / 2, top - height

def link(source, target, left_to_right=True, style='-'):
    a = anchor(source, 'right' if left_to_right else 'bottom')
    b = anchor(target, 'left' if left_to_right else 'top')
    edge = ConnectionPatch(a, b, 'data', 'data', axesA=ax, axesB=ax,
                           arrowstyle='-|>', mutation_scale=10, linewidth=1.5,
                           color=GREEN if style == '-' else ORANGE,
                           alpha=.45 if style == '-' else .55, linestyle=style,
                           connectionstyle='arc3,rad=.08' if left_to_right else 'arc3,rad=0')
    ax.add_patch(edge)

# Selected direct FK relationships. Every FK, including links omitted to avoid
# crossing the whole image, is printed in its child table.
for source, target in [
    ('kitchens', 'dishes'), ('dishes', 'offers'), ('orders', 'order_reviews'),
    ('offers', 'order_items'), ('order_items', 'order_item_reviews'),
]: link(source, target)
for source, target in [
    ('kitchens', 'users'), ('users', 'sessions'),
    ('dishes', 'option_groups'), ('option_groups', 'option_choices'),
    ('offers', 'offer_option_groups'), ('offer_option_groups', 'offer_option_choices'),
    ('orders', 'order_items'), ('order_items', 'order_item_choices'),
    ('order_reviews', 'order_item_reviews'),
]: link(source, target, left_to_right=False)
ax.add_patch(ConnectionPatch(anchor('kitchens', 'top'), anchor('kitchen_images', 'bottom'),
             'data', 'data', axesA=ax, axesB=ax, arrowstyle='-|>', mutation_scale=10,
             linewidth=1.5, color=GREEN, alpha=.45))

for name, (x, top, title, fields) in entities.items():
    ax.add_patch(FancyBboxPatch((x, top-height), width, height,
                 boxstyle='round,pad=.003,rounding_size=.009', facecolor=WHITE,
                 edgecolor=BORDER, linewidth=1.2, zorder=5))
    ax.add_patch(FancyBboxPatch((x, top-.036), width, .036,
                 boxstyle='round,pad=.003,rounding_size=.009', facecolor=GREEN,
                 edgecolor=GREEN, zorder=6))
    ax.add_patch(plt.Rectangle((x, top-.038), width, .012, color=GREEN, zorder=6))
    ax.text(x+.008, top-.019, title, color=WHITE, fontsize=11.5,
            weight='bold', va='center', zorder=7)
    step = .022 if len(fields) <= 4 else .019
    for i, field in enumerate(fields):
        color = ORANGE if 'PK' in field else (GREEN if 'FK' in field else INK)
        ax.text(x+.009, top-.052-i*step, field, color=color, fontsize=8.8,
                va='center', zorder=7)

ax.text(.025, .013, 'PK = clave primaria   ·   FK = referencia a otra tabla   ·   Líneas: relaciones directas principales; las demás FK figuran dentro de las tablas',
        color=MUTED, fontsize=10.5, va='bottom')
ax.text(.975, .017, 'Fuente: server/migrations/0001_initial.sql',
        color=MUTED, fontsize=9.5, ha='right', va='bottom')

output = Path(__file__).resolve().parents[2] / 'menuu-consumidores-diagrama-er.png'
fig.savefig(output, dpi=180, facecolor=CREAM, bbox_inches='tight', pad_inches=.2)
plt.close(fig)
print(output)
