import math
import random
from time import time
from typing import Any, Dict, List, Tuple
from uuid import uuid4

from django.contrib.auth import authenticate
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from imagination import container
from jwt import ExpiredSignatureError

from minesweeper.common.rest_api_utils import respond_error, handle_root_api_request, get_authorized_user_id, \
    handle_api_request_for_one_resource
from minesweeper.common.token_service import TokenService
from minesweeper.models import GameMove, GameSession

token_service: TokenService = container.get(TokenService)


##### MISC API #####


def api_ping(request):
    return JsonResponse({'ping': 'pong'})


def api_me(request):
    """ Check if the token is still valid. """
    bearer_token = request.headers.get('authorization')

    if not bearer_token:
        return JsonResponse({'authorized': False, 'reason': 'missing_token'})
    else:
        try:
            return JsonResponse({
                'authorized': True,
                'claims': token_service.decode_token(bearer_token[7:])
            })
        except ExpiredSignatureError as e:
            return JsonResponse({'authorized': False, 'reason': 'expired_token'})


##### Mini OAuth #####


@csrf_exempt
def api_oauth_exchange_tokens(request):
    """ Exchange a token """
    for field_name in ['grant_type', 'client_id', 'client_secret']:
        if field_name not in request.POST:
            return JsonResponse({'error': f'missing_{field_name}'})

    if request.POST['grant_type'] != 'client_credentials':
        return JsonResponse({'error': 'invalid_grant_type'}, status=400)

    user = authenticate(username=request.POST['client_id'],
                        password=request.POST['client_secret'])

    if user:
        return JsonResponse(token_service.generate_tokens(user))
    else:
        return respond_error(400, 'invalid_credentials')


@csrf_exempt
def api_oauth_refresh_tokens(request):
    """ Refresh the tokens """
    for field_name in ['grant_type', 'refresh_token']:
        if field_name not in request.POST:
            return respond_error(400, f'missing_{field_name}')

    if request.POST['grant_type'] != 'refresh_token':
        return respond_error(400, 'invalid_grant_type')

    return JsonResponse(token_service.refresh_tokens(request.POST['refresh_token']))


##### REST: Session #####


def _create_new_session(entry: Dict[str, Any], user_id: int) -> GameSession:
    new_session = GameSession(
        id=str(uuid4()),
        userId=user_id,
        state=None,
        createTime=math.floor(time()),
        width=entry['width'],
        height=entry['height'],
        mineDensity=entry['mineDensity'],
        mineCoordinates=[],
    )

    expected_mine_count: int = math.ceil(new_session.width * new_session.height * new_session.mineDensity / 100)
    coordinate_map: Dict[Tuple[int, int], Dict[str, int]] = dict()

    while len(coordinate_map) < expected_mine_count:
        x = math.floor(random.randint(0, new_session.width - 1))
        y = math.floor(random.randint(0, new_session.height - 1))
        coordinate = (x, y)
        if coordinate in coordinate_map:
            continue
        else:
            coordinate_map[coordinate] = dict(x=x, y=y)
    # end: while

    new_session.mineCoordinates = [c for c in coordinate_map.values()]

    return new_session


@csrf_exempt
def game_session_root(request: HttpRequest):
    """ Root-level Game Session API """
    return handle_root_api_request(
        request,
        GameSession,
        map_dict_to_object=lambda entry: _create_new_session(entry, get_authorized_user_id(request, 'game')),
        sorting_order=['-createTime'],
        reiterate_list=None
    )


def _update_game_session(game_session: GameSession, entry: Dict[str, Any]) -> GameSession:
    game_session.state = entry['state']

    return game_session


@csrf_exempt
def game_session_individual(request: HttpRequest, id: str):
    """ One-resource-level Game Session API """
    return handle_api_request_for_one_resource(request, GameSession, id, _update_game_session)


##### REST: Move #####


def _create_new_move(entry: Dict[str, Any]) -> GameMove:
    assert 'gameId' in entry and entry['gameId'], 'gameId'
    assert 'userId' in entry and entry['userId'], 'userId'

    return GameMove(
        gameId=entry['gameId'],
        userId=entry['userId'],
        x=entry['x'],
        y=entry['y'],
        state=entry['state'],
        createTime=math.floor(time()),
    )


def _collage_moves(original_list: List[GameMove]) -> List[GameMove]:
    """ Re-iterate the move list and only keep the last known state of each coordinate. """
    sequence: List[Tuple[str, str]] = list()
    lastKnownMoves: Dict[Tuple[str, str], GameMove] = dict()

    for move in original_list:
        coordinate = (move.x, move.y)

        if coordinate in lastKnownMoves:
            continue
        else:
            lastKnownMoves[coordinate] = move
            sequence.append(coordinate)

    return [lastKnownMoves[coordinate] for coordinate in sequence]


@csrf_exempt
def game_move_root(request: HttpRequest):
    """ Root-level Game Move API """
    return handle_root_api_request(
        request,
        GameMove,
        map_dict_to_object=_create_new_move,
        sorting_order=['-id'],
        reiterate_list=_collage_moves
    )


@csrf_exempt
def game_move_individual(request: HttpRequest, id: str):
    """ One-resource-level Game Move API """
    return handle_api_request_for_one_resource(request, GameMove, id, map_dict_to_object=None)
