import logging
import os

import resend

logger = logging.getLogger("mathboard.mail")


def is_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY"))



def send_password_reset_email(email: str, reset_link: str) -> None:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning(f"[DEV EMAIL] Password reset requested for {email}: {reset_link}")
        return

    resend.api_key = api_key

    from_email = os.getenv("RESEND_FROM_EMAIL", "Mathboard <onboarding@resend.dev>")
    resend.Emails.send({
        "from": from_email,
        "to": email,
        "subject": "Reset your Mathboard password",
        "html": (
            "<p>Click the link below to reset your password:</p>"
            f'<p><a href="{reset_link}">{reset_link}</a></p>'
            "<p>If you didn't request this, you can ignore this email.</p>"
        ),
    })
