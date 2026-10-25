from fastapi import APIRouter

from app.api.v1.ask import router as ask_router
from app.api.v1.collections import router as collections_router
from app.api.v1.documents import router as documents_router
from app.api.v1.health import router as health_router
from app.api.v1.search import router as search_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(collections_router)
api_router.include_router(documents_router)
api_router.include_router(search_router)
api_router.include_router(ask_router)
