from pathlib import Path

from firebase_admin import credentials, firestore, get_app, initialize_app

from app.config import settings


def _get_firebase_credential():
    if settings.firebase_credentials_path:
        credentials_path = Path(settings.firebase_credentials_path)
        if not credentials_path.is_absolute():
            credentials_path = Path.cwd() / credentials_path

        return credentials.Certificate(str(credentials_path))

    if (
        settings.firebase_project_id
        and settings.firebase_client_email
        and settings.firebase_private_key
    ):
        return credentials.Certificate(
            {
                "type": "service_account",
                "project_id": settings.firebase_project_id,
                "client_email": settings.firebase_client_email,
                "private_key": settings.firebase_private_key.replace("\\n", "\n"),
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )

    raise RuntimeError(
        "Firebase credentials not configured. Set FIREBASE_CREDENTIALS_PATH "
        "or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    )


def get_db():
    try:
        app = get_app()
    except ValueError:
        app = initialize_app(_get_firebase_credential())

    return firestore.client(app)
