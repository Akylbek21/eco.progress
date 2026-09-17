#!/usr/bin/env python3
"""Отправка письма через SMTP с необязательным вложением.

Вызывается из backup-db.sh; все параметры приходят через окружение, чтобы пароль не попадал
в аргументы команды - иначе он был бы виден любому пользователю сервера в `ps aux`.

Окружение:
    SUBJECT, BODY        тема и текст письма (обязательны)
    ATTACH               путь к файлу вложения; пустая строка - без вложения
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, MAIL_TO   из .env

Код возврата: 0 - отправлено, 1 - не отправлено (текст ошибки в stderr). Скрипт бэкапа
намеренно не считает неудачу отправки неудачей бэкапа: дамп уже лежит на диске.
"""
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from pathlib import Path


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"Не задано {name} (проверьте .env)")
    return value


def main() -> int:
    host = require("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = require("SMTP_USER")
    password = require("SMTP_PASS")
    sender = os.environ.get("SMTP_FROM", "").strip() or user
    recipients = [a.strip() for a in require("MAIL_TO").split(",") if a.strip()]

    message = EmailMessage()
    message["Subject"] = require("SUBJECT")
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    message.set_content(os.environ.get("BODY", ""))

    attach = os.environ.get("ATTACH", "").strip()
    if attach:
        path = Path(attach)
        if not path.is_file():
            sys.exit(f"Файл вложения не найден: {path}")
        message.add_attachment(
            path.read_bytes(),
            maintype="application",
            subtype="gzip",
            filename=path.name,
        )

    context = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=60) as smtp:
                smtp.login(user, password)
                smtp.send_message(message)
        else:
            # 587 - STARTTLS: соединение открывается незашифрованным и поднимается до TLS,
            # поэтому логин строго после starttls(), иначе пароль уйдёт открытым текстом.
            with smtplib.SMTP(host, port, timeout=60) as smtp:
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.ehlo()
                smtp.login(user, password)
                smtp.send_message(message)
    except smtplib.SMTPAuthenticationError:
        print(
            "SMTP отклонил логин. Для Gmail нужен пароль приложения (App Password) при "
            "включённой двухфакторной аутентификации, обычный пароль аккаунта не подойдёт.",
            file=sys.stderr,
        )
        return 1
    except Exception as exc:  # noqa: BLE001 - причина уходит в лог cron как есть
        print(f"Письмо не отправлено: {exc}", file=sys.stderr)
        return 1

    print(f"Письмо отправлено: {', '.join(recipients)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
