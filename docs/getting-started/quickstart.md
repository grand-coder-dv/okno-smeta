---
description: Как открыть ОкноСмету локально без сборки и зависимостей
icon: rocket
---

# Быстрый старт

Сборки нет: приложение — статические модули ES в папке `app/`. Браузер не подгружает `import` при открытии `index.html` двойным щелчком, поэтому нужен локальный HTTP-сервер.

{% stepper %}

{% step %}
### Клонируйте репозиторий

```bash
git clone https://github.com/grand-coder-dv/okno-smeta.git
cd okno-smeta
```
{% endstep %}

{% step %}
### Запустите сервер из папки app

{% tabs %}
{% tab title="Python" %}
```bash
cd app
python -m http.server 8080
```
{% endtab %}

{% tab title="Node (npx)" %}
```bash
cd app
npx --yes serve -p 8080
```
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
### Откройте в браузере

Перейдите по адресу [http://localhost:8080](http://localhost:8080).
{% endstep %}

{% endstepper %}

{% hint style="warning" %}
Точка входа — `app/index.html`, который подключает один модуль `app/boot.js`. Остальные файлы связаны через `import`.
{% endhint %}