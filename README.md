Скопировать _config.js в config.js

Настроить YouTrack:

Получить токен youtrack https://www.jetbrains.com/help/youtrack/incloud/Manage-Permanent-Token.html
Записать его в config.js поле YTToken.
В поле YTSpace записать имя репозитория (**\<YTSpace>**.myjetbrains.com).

Зарегистрироваться на Slack

Создать приложение https://api.slack.com/apps/new .

После создания:

Перейти на вкладку Basic Information. Содержимое поля Verification Token скопировать в config.js поле SLACK_VERIFICATION_TOKEN

Перейти на вкладку OAuth & Permissions, раздел Scopes. Добавить inks:read и links:write. Сохранить.
Нажать Install App to Workspace
Скопировать поле OAuth Access Token в config.js поле SLACK_CLIENT_TOKEN

Запустить сервер. Сейчас на https://tranquil-woodland-76768.herokuapp.com/

Вернуться в настройки бота Slack

Вкладка Event Subscriptions

Включить Enable Events

В поле Request URL ввести адрес бота https://tranquil-woodland-76768.herokuapp.com/slack/events (имя хоста плюс /slack/events). Должна появиться метка Verified

В разделе Subscribe to Workspace Events добавить link_shared

В разделе App Unfurl Domains добавить \<YTSpace>.myjetbrains.com

Сохранить
