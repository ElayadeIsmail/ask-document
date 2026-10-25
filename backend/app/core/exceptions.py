class AskDocError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class NotFoundError(AskDocError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status_code=404)


class ConflictError(AskDocError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=409)


class DependencyUnavailableError(AskDocError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=503)
