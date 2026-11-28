---
description: Какой файл app/ за что отвечает — карта для правок и вайбкодинга
icon: code
---

# Карта модулей

Статическое приложение без сборки. Graphify индексирует `app/`, а не `dist/`.

{% hint style="info" %}
Править только файл, который отвечает за задачу. Общие имена в проекте: `state`, `renderAll`, `buildSpecification`, `geometry`.
{% endhint %}

## Модули `app/`

| Файл | Назначение |
| --- | --- |
| `catalog.js` | Профили, стекло, цены, технология, localStorage |
| `product.js` | Состояние изделия, форма, проверки |
| `order.js` | Изделия заказа и проекты |
| `geometry.js` | Импосты, секции, площадь |
| `estimate.js` | Стоимость и строки сметы |
| `drawing.js` | Контуры, дуги, скосы |
| `canvas.js` | Рисунок SVG |
| `canvas-input.js` | Мышь и клавиши на холсте |
| `editor-ui.js` | Инспектор, итог, кнопки, `renderAll` |
| `settings.js` | Прайс и каталог в диалоге настроек |
| `boot.js` | Первый запуск страницы |
| `reports.js` | Печатные документы |
| `impost-selection.js` | Выбор нескольких импостов |
| `editor-history.js` | Отмена и повтор |
| `editor-tools.js` | Кнопки створки и импоста |

## Стили

- `styles.css` — основной интерфейс
- `proposal-report.css` — печать предложения
- `technology-catalog.css` — каталог технологий
- `glass-profile-style.css` — стекло и профиль

<details>
<summary>sash-imposts.js</summary>

`app/sash-imposts.js` в страницу **не подключён**. Не подключать без отдельной задачи.
</details>