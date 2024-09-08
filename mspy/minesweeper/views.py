import json
import math
from time import time
from typing import Any, Callable, Dict, List, Optional, Tuple, Type, TypeVar
from uuid import uuid4
from django.contrib.auth import authenticate
from django.forms import model_to_dict
from django.http import JsonResponse, HttpResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from imagination import container
from jwt import ExpiredSignatureError

from minesweeper.common.token_service import TokenService
from minesweeper.models import GameMove, GameSession

token_service: TokenService = container.get(TokenService)


class AccessDeniedError(RuntimeError):
    pass


class UnauthenticatedError(RuntimeError):
    pass


def _decode_token(request: HttpRequest):
    """ Decode the bearer token """
    bearer_token = request.headers.get('authorization')

    if not bearer_token:
        return None
    else:
        try:
            return token_service.decode_token(bearer_token[7:])
        except ExpiredSignatureError as e:
            return None


def get_authorized_user_id(request: HttpRequest, scope: str) -> int:
    """ Get the user ID from the incoming bearer token and perform a simple scope check """
    claims = _decode_token(request)
    if claims is None:
        raise UnauthenticatedError()
    elif claims['scope'] == scope:
        return int(claims['sub'])
    else:
        raise AccessDeniedError('invalid_scope')


def _respond_ok(obj):
    """ Simply make a JSON response """
    response = JsonResponse(obj, safe=False)
    if isinstance(obj, (list, dict, set, tuple)):
        response.headers['X-Size'] = len(obj)  # For debuggin purpose
    return response


def _respond_error(status: int, error_message: Optional[str] = None):
    """ Simply make an error JSON response, with exception of HTTP 401 """
    if status == 401:
        return HttpResponse('', status=401)
    else:
        return JsonResponse({'error': error_message}, status=status)


T = TypeVar('T')


def _handle_root_api_request(request: HttpRequest,
                             cls: Type[T],
                             create_obj: Callable[[Dict[str, Any]], T],
                             list_order: List[str],
                             process_list: Callable[[List[T]], List[T]]):
    """ Handle all requests at the root level of the rest API, e.g., "/api/<resource_type>/".

        This includes listing all resources owned by the authenticated user and creating a new resource.
    """
    try:
        user_id = get_authorized_user_id(request, 'game')
    except UnauthenticatedError:
        return _respond_error(401)
    except AccessDeniedError as e:
        return _respond_error(403, e.args[0])

    if request.method == 'GET':
        filters = {
            k[7:]: v
            for k, v in request.GET.items()
            if k.startswith('filter_') and v
        }

        obj_list = [obj for obj in cls.objects.filter(userId=user_id, **filters).order_by(*list_order)]

        if process_list:
            obj_list = process_list(obj_list)

        return _respond_ok([model_to_dict(obj) for obj in obj_list])
    elif request.method == 'POST':
        request_body = json.loads(request.body)
        try:
            new_obj = create_obj(request_body)
            new_obj.save()

            return _respond_ok(model_to_dict(new_obj))
        except KeyError as e:
            return _respond_error(400, f'invalid_request/{e.args[0]}')
    else:
        return _respond_error(405, 'method_not_allowed')


def _handle_api_request_for_one_resource(request: HttpRequest,
                                         cls: Type[T],
                                         id: Any,
                                         update_obj: Optional[Callable[[T, Dict[str, Any]], T]]):
    """ Handle all requests for one resource, identified by "id", e.g., "/api/<resource_type>/<id>".

        This includes fetching ONE resource by ID, updating it (partial replacement), and deleting it.
    """
    try:
        user_id = get_authorized_user_id(request, 'game')
    except UnauthenticatedError:
        return _respond_error(401)
    except AccessDeniedError as e:
        return _respond_error(403, e.args[0])

    obj = cls.objects.get(id=id)

    if obj is None:
        return _respond_error(404, 'not_found')

    if obj.userId != user_id:
        return _respond_error(404, 'not_found')  # Fake 404 to prevent scanning.

    if request.method == 'GET':
        if obj:
            return _respond_ok(model_to_dict(obj))
        else:
            return _respond_error(404, 'not_found')
    elif request.method == 'PUT':
        if update_obj is None:
            return _respond_error(405, 'method_not_allowed')

        request_body = json.loads(request.body)
        updated_obj = update_obj(obj, request_body)
        updated_obj.save()

        return _respond_ok(model_to_dict(obj))
    elif request.method == 'DELETE':
        obj.delete()
        return HttpResponse(content='', status=204)
    else:
        return _respond_error(405, 'method_not_allowed')


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
        return _respond_error(400, 'invalid_credentials')


@csrf_exempt
def api_oauth_refresh_tokens(request):
    """ Refresh the tokens """
    for field_name in ['grant_type', 'refresh_token']:
        if field_name not in request.POST:
            return _respond_error(400, f'missing_{field_name}')


    if request.POST['grant_type'] != 'refresh_token':
        return _respond_error(400, 'invalid_grant_type')

    return JsonResponse(token_service.refresh_tokens(request.POST['refresh_token']))


##### REST: Session #####


@csrf_exempt
def game_session_root(request: HttpRequest):
    """ Root-level Game Session API """
    return _handle_root_api_request(
        request,
        GameSession,
        create_obj=lambda entry: GameSession(
            id=str(uuid4()),
            userId=get_authorized_user_id(request, 'game'),
            state=None,
            createTime=math.floor(time()),
            width=entry['width'],
            height=entry['height'],
            mineDensity=entry['mineDensity'],
            mineCoordinates=entry['mineCoordinates'],
        ),
        list_order=['-createTime'],
        process_list=None
    )


def _update_game_session(game_session: GameSession, entry: Dict[str, Any]) -> GameSession:
    game_session.state = entry['state']

    return game_session


@csrf_exempt
def game_session_individual(request: HttpRequest, id: str):
    """ One-resource-level Game Session API """
    return _handle_api_request_for_one_resource(request, GameSession, id, _update_game_session)


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
    sequence: List[Tuple[str]] = list()
    lastKnownMoves: Dict[Tuple[str], GameMove] = dict()

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
    return _handle_root_api_request(
        request,
        GameMove,
        create_obj=_create_new_move,
        list_order=['-id'],
        process_list=_collage_moves
    )


@csrf_exempt
def game_move_individual(request: HttpRequest, id: str):
    """ One-resource-level Game Move API """
    return _handle_api_request_for_one_resource(request, GameMove, id, update_obj=None)

