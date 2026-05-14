-- Migration: 005_seed_catalogs
-- Seed catalog data with deterministic UUIDs (v5)
-- Generated from namespace: 6ba7b810-9dad-11d1-80b4-00c04fd430c8

-- Stop reasons (23 reasons from PARO_REASONS)
INSERT INTO public.stop_reasons (id, code, label, category, macro, stops_line, sort_order) VALUES
('9474469d-1a88-50fc-9a34-0be516f743c9', 'FMP',  'Falta materia prima',           'produccion',    'PROD',  true,  1),
('1a06037a-deb0-5583-8089-029bdb806353', 'AT',   'Arranque de turno',             'produccion',    'PROD',  false, 2),
('27da949d-b430-5152-8df5-71d1087d6f42', 'FME',  'Falta material empaque',        'produccion',    'PROD',  true,  3),
('1e75c965-7b49-57b8-95be-2486318b1df3', 'AO',   'Ajuste de operación',           'produccion',    'PROD',  false, 4),
('bccd387c-ae2a-554d-8667-e7a3d4d2a5ca', 'CP',   'Cambio de presentación',        'produccion',    'PROD',  true,  5),
('17debba0-0844-5774-ad23-e475282573c0', 'CN',   'Cambio de nomenclatura',        'produccion',    'PROD',  true,  6),
('ef5f5187-e305-5f7f-8f81-027f96843da6', 'EQ',   'Espera de químico',             'produccion',    'PROD',  false, 7),
('d7fcba71-1b6c-54b9-b627-9a1e7d2c1389', 'FC',   'Falla de Cavemil',              'mantenimiento', 'MTTO',  true,  8),
('23611c43-7c43-54e3-bfca-786bcb0804b9', 'FS',   'Falla de Servicios',            'mantenimiento', 'MTTO',  true,  9),
('183d37f3-13a0-5ffb-b143-636785f2bd16', 'FM',   'Falla de molino',               'mantenimiento', 'MTTO',  true,  10),
('f726c531-07b8-5671-bf10-8055f0cb8260', 'FT',   'Falla de tostador',             'mantenimiento', 'MTTO',  true,  11),
('3a1e005b-7ad8-51f9-85c9-136c4ef8a374', 'MC',   'Mantenimiento correctivo',      'mantenimiento', 'MTTO',  true,  12),
('0ee59afd-967f-5ae6-a472-9f8b91915442', 'MP',   'Mantenimiento preventivo',      'mantenimiento', 'MTTO',  true,  13),
('88aa31db-a253-5295-9b59-b84093fac6af', 'RCC',  'Retrabajo por calidad',         'calidad',       'OTROS', true,  14),
('030235f6-e9fa-5a2e-a84a-f3bfc8c65e09', 'AC',   'Ajuste de calidad',             'calidad',       'OTROS', false, 15),
('aa0e66b2-51c9-5ee9-8913-98913a1875e3', 'EMC',  'Evaluación material cliente',   'calidad',       'OTROS', true,  16),
('15a45b0e-7b33-509b-93ad-a41f4aa0a9d9', 'IS',   'Incidente de seguridad',        'seguridad',     'OTROS', true,  17),
('ec17b853-c72b-560a-befc-6a57c47be5f3', 'EP',   'Ejercicio de protección civil', 'seguridad',     'OTROS', true,  18),
('8d171351-e851-5346-8047-20a730fbe8bc', 'FPRH', 'Falta personal (RH)',           'otros',         'OTROS', true,  19),
('b9d1eacd-6a1f-5a86-b5f1-3f51f88d55e5', 'DALM', 'Demora almacén',                'otros',         'OTROS', true,  20),
('3b36531d-7c74-526e-ae5c-a4c2c9fb73a0', 'CAP',  'Capacitación',                  'otros',         'OTROS', true,  21),
('d4b2d3de-b0b5-54fb-bd0e-4f8d37055229', 'LIM',  'Limpieza general',              'otros',         'OTROS', false, 22),
('f1f6ec07-ccc4-511e-934c-9e30a1377e2a', 'REU',  'Reunión / Junta',               'otros',         'OTROS', true,  23)
ON CONFLICT (code) DO NOTHING;

-- Products (deterministic UUIDs)
INSERT INTO public.products (id, code, name, theoretical_ppm) VALUES
('9f5558cc-06fa-5aa5-aa03-9d74e7121526', 'CHOC-500', 'Chocolate 500g', 2.5),
('887476c0-218b-5131-bf2a-63dd7cdf3861', 'CHOC-250', 'Chocolate 250g', 3.0)
ON CONFLICT (code) DO NOTHING;

-- Shifts (deterministic UUIDs)
INSERT INTO public.shifts (id, label, start_hour, end_hour) VALUES
('c7d7760b-d3f2-596a-b0ee-88e4f2ab8b34', 'Turno 1 (06-14)', 6,  14),
('17efa643-1ca5-585c-ab03-7ea8711efca0', 'Turno 2 (14-22)', 14, 22),
('85c10e19-6f06-5866-a031-00515a69a8c0', 'Turno 3 (22-06)', 22, 6)
ON CONFLICT (id) DO NOTHING;
