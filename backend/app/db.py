from firebase_admin import credentials, firestore, get_app, initialize_app

from app.config import settings


def _get_firebase_credential():
    if settings.FIREBASE_CREDENTIALS_PATH:
        return credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)

    if (
        settings.FIREBASE_PROJECT_ID
        and settings.FIREBASE_CLIENT_EMAIL
        and settings.FIREBASE_PRIVATE_KEY
    ):
        return credentials.Certificate(
            {
                "type": "service_account",
                "project_id": settings.FIREBASE_PROJECT_ID,
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
                "private_key": settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n"),
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
