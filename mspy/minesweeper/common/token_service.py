import os
from time import time
from typing import Any, Dict

from django.contrib.auth.models import User
from imagination.decorator.service import Service
import jwt


@Service()
class TokenService:
    def __init__(self):
        self._secret = os.environ['JWT_SECRET']
        self._issuer = 'minesweeper'
        self._access_token_ttl = 7200  # 2 hours
        self._refresh_token_ttl = 86400  # 1 day

    def _generate_tokens(self, subject_id):
        issue_time = time()

        claims_for_access_token = {
            'scope': 'game',
            'iss': self._issuer,
            'sub': str(subject_id),
            'exp': issue_time + self._access_token_ttl,
        }

        claims_for_refresh_token = {
            'scope': 'refresh',
            'iss': self._issuer,
            'sub': str(subject_id),
            'exp': issue_time + self._refresh_token_ttl,
        }

        return {
            "access_token": jwt.encode(claims_for_access_token, self._secret, algorithm='HS256'),
            "expires_in": claims_for_access_token['exp'] - time(),
            "refresh_token": jwt.encode(claims_for_refresh_token, self._secret, algorithm='HS256'),
            "token_type": "Bearer",
        }

    def generate_tokens(self, user: User):
        return self._generate_tokens(user.pk)

    def decode_token(self, token: str) -> Dict[str, Any]:
        return jwt.decode(token, self._secret, algorithms=["HS256"])

    def refresh_tokens(self, refresh_token: str):
        incoming_claims = self.decode_token(refresh_token)
        return self._generate_tokens(incoming_claims['sub'])
