import logging
import os
import smtplib
from email.message import EmailMessage
from html import escape

logger = logging.getLogger("mathboard.mail")

SMTP_TIMEOUT_SECONDS = 15


def is_configured() -> bool:
    return all(os.getenv(name) for name in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"))


def dev_reset_links_enabled() -> bool:
    """Whether /forgot-password may put the reset link in its response. Off unless ALLOW_DEV_RESET_LINK is set on purpose: anyone who can call the endpoint sees the response, so a link there is a password reset for any registered email."""
    return os.getenv("ALLOW_DEV_RESET_LINK", "").strip().lower() in {"1", "true", "yes"}


def _open_connection(host: str, port: int) -> smtplib.SMTP:
    """Port 465 is TLS from the first byte; anything else (587) starts plain and upgrades with STARTTLS. Either way the password is never sent unencrypted."""
    if port == 465:
        return smtplib.SMTP_SSL(host, port, timeout=SMTP_TIMEOUT_SECONDS)
    server = smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS)
    server.starttls()
    return server


def send_password_reset_email(email: str, reset_link: str) -> None:
    """Never raises: a delivery failure must not change the API response, since an error only for registered emails would reveal which ones are. Failures go to the log."""
    if not is_configured():
        logger.warning(f"[DEV EMAIL] Password reset requested for {email}: {reset_link}")
        return

    user = os.environ["SMTP_USER"]
    message = EmailMessage()
    message["Subject"] = "Reset your Mathboard password"
    message["From"] = os.getenv("SMTP_FROM") or user
    message["To"] = email
    message.set_content(
        "Open the link below to reset your password:\n\n"
        f"{reset_link}\n\n"
        "The link works once and expires in 30 minutes. If you didn't request this, you can ignore this email."
    )
    safe_link = escape(reset_link, quote=True)
    message.add_alternative(
        "<p>Click the link below to reset your password:</p>"
        f'<p><a href="{safe_link}">{safe_link}</a></p>'
        "<p>The link works once and expires in 30 minutes. If you didn't request this, you can ignore this email.</p>",
        subtype="html",
    )

    try:
        with _open_connection(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587"))) as server:
            server.login(user, os.environ["SMTP_PASSWORD"])
            server.send_message(message)
    except Exception:
        logger.exception("Password reset email to %s could not be sent", email)
