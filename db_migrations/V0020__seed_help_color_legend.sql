INSERT INTO t_p71061117_crm_client_managemen.help_sections (sort_order, icon, title, items, section_type)
VALUES (9, 'Palette', 'Цветовые пометки строк', '[]', 'colors');

INSERT INTO t_p71061117_crm_client_managemen.help_color_legend (section_id, sort_order, color, label, description)
SELECT id, 1, '#22c55e', 'Зелёный — контракт загружен', 'Строка автоматически становится зелёной, когда в карточке кандидата загружено фото контракта.'
FROM t_p71061117_crm_client_managemen.help_sections WHERE title = 'Цветовые пометки строк' LIMIT 1;

INSERT INTO t_p71061117_crm_client_managemen.help_color_legend (section_id, sort_order, color, label, description)
SELECT id, 2, '#ef4444', 'Красный — проблемный кандидат', 'Используйте для кандидатов с проблемами: документы не в порядке, отказал работодатель и т.д.'
FROM t_p71061117_crm_client_managemen.help_sections WHERE title = 'Цветовые пометки строк' LIMIT 1;

INSERT INTO t_p71061117_crm_client_managemen.help_color_legend (section_id, sort_order, color, label, description)
SELECT id, 3, '#f97316', 'Оранжевый — на контроле', 'Требует особого внимания или дополнительной проверки.'
FROM t_p71061117_crm_client_managemen.help_sections WHERE title = 'Цветовые пометки строк' LIMIT 1;

INSERT INTO t_p71061117_crm_client_managemen.help_color_legend (section_id, sort_order, color, label, description)
SELECT id, 4, '#3b82f6', 'Синий — в работе', 'Кандидат находится в процессе оформления или ожидает ответа.'
FROM t_p71061117_crm_client_managemen.help_sections WHERE title = 'Цветовые пометки строк' LIMIT 1;
