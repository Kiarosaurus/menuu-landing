UPDATE kitchens SET image_url = replace(image_url, '.png', '.webp')
WHERE id IN ('chaufa-club', 'la-esquina-criolla')
  AND image_url IN ('/images/chaufa-wok.png', '/images/lomo-saltado.png');

UPDATE dishes SET image_url = replace(image_url, '.png', '.webp')
WHERE (kitchen_id, id) IN (('chaufa-club', 'chaufa-de-pollo'), ('la-esquina-criolla', 'lomo-saltado'), ('la-esquina-criolla', 'aji-de-gallina'))
  AND image_url IN ('/images/chaufa-wok.png', '/images/lomo-saltado.png', '/images/aji-de-gallina.png');
